import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.module';
import { GmailClientService } from './gmail-client.service';
import { GoogleOAuthService, GoogleTokenRevokedError } from './google-oauth.service';
import { isUsableKey, open, seal } from './mailbox-crypto';

const STATUS_LABELS: Record<MailboxStatus, string> = {
  [MailboxStatus.CONECTADA]: 'conectada',
  [MailboxStatus.DESCONECTADA]: 'desconectada',
  [MailboxStatus.PAUSADA]: 'pausada',
};

export const MAX_CONSECUTIVE_ERRORS = 10;

@Injectable()
export class MailboxService {
  private readonly logger = new Logger(MailboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly oauth: GoogleOAuthService,
    private readonly gmail: GmailClientService,
  ) {}

  private get encryptionKey(): string {
    return String(this.config.get('CORRESPONDENCIA_TOKEN_KEY') || '').trim();
  }

  /**
   * Intercambia el código de Google, pregunta a Google cuál es la dirección
   * real del buzón y guarda el refresh token cifrado. Si la cuenta ya existía
   * la reconecta en lugar de duplicarla, conservando su historial.
   */
  async connectFromCode(code: string, userId: string | null) {
    if (!isUsableKey(this.encryptionKey)) {
      throw new BadRequestException(
        'CORRESPONDENCIA_TOKEN_KEY debe tener al menos 32 caracteres para poder guardar cuentas.',
      );
    }
    const tokens = await this.oauth.exchangeCode(code);
    const profile = await this.gmail.getProfile(tokens.accessToken);
    if (!profile.emailAddress) {
      throw new BadRequestException('Google no devolvió la dirección del buzón autorizado.');
    }
    const sealed = seal(String(tokens.refreshToken), this.encryptionKey);
    const data = {
      refreshTokenCifrado: sealed.ciphertext,
      refreshTokenIv: sealed.iv,
      refreshTokenTag: sealed.tag,
      estado: MailboxStatus.CONECTADA,
      ultimoError: null,
      erroresConsecutivos: 0,
      conectadaPorId: userId,
    };
    const account = await this.prisma.cuentaCorreo.upsert({
      where: { direccion: profile.emailAddress },
      update: data,
      create: { ...data, direccion: profile.emailAddress },
      select: { id: true, direccion: true },
    });
    this.logger.log(`Cuenta de correo conectada: ${account.direccion}`);
    return account;
  }

  async list() {
    const accounts = await this.prisma.cuentaCorreo.findMany({
      orderBy: [{ direccion: 'asc' }],
      select: {
        id: true,
        direccion: true,
        etiqueta: true,
        estado: true,
        ultimaSincronizacion: true,
        ultimoError: true,
        erroresConsecutivos: true,
        correosProcesados: true,
        creadoEn: true,
        conectadaPor: { select: { id: true, fullName: true, email: true } },
      },
    });
    return {
      // Nunca se devuelve token alguno, ni cifrado.
      items: accounts.map(account => ({
        ...account,
        estado: STATUS_LABELS[account.estado],
        conectada_por: account.conectadaPor || null,
        conectadaPor: undefined,
      })),
      configuracion: {
        google_configurado: this.oauth.isConfigured(),
        clave_cifrado_valida: isUsableKey(this.encryptionKey),
      },
    };
  }

  async update(id: string, changes: { etiqueta?: string | null; activa?: boolean }) {
    const account = await this.prisma.cuentaCorreo.findUnique({ where: { id }, select: { id: true, estado: true } });
    if (!account) throw new NotFoundException('Cuenta de correo no encontrada.');
    // Una cuenta desconectada no se puede reactivar sin volver a autorizarla en Google.
    const estado =
      changes.activa === undefined || account.estado === MailboxStatus.DESCONECTADA
        ? undefined
        : changes.activa
          ? MailboxStatus.CONECTADA
          : MailboxStatus.PAUSADA;
    await this.prisma.cuentaCorreo.update({
      where: { id },
      data: {
        etiqueta: changes.etiqueta === undefined ? undefined : changes.etiqueta || null,
        estado,
      },
    });
    return this.detail(id);
  }

  async detail(id: string) {
    const account = await this.prisma.cuentaCorreo.findUnique({
      where: { id },
      select: {
        id: true,
        direccion: true,
        etiqueta: true,
        estado: true,
        ultimaSincronizacion: true,
        ultimoError: true,
        erroresConsecutivos: true,
        correosProcesados: true,
      },
    });
    if (!account) throw new NotFoundException('Cuenta de correo no encontrada.');
    return { ...account, estado: STATUS_LABELS[account.estado] };
  }

  /** Desvincular borra los tokens pero conserva los correos ya clasificados. */
  async disconnect(id: string) {
    await this.detail(id);
    await this.prisma.cuentaCorreo.update({
      where: { id },
      data: {
        refreshTokenCifrado: null,
        refreshTokenIv: null,
        refreshTokenTag: null,
        estado: MailboxStatus.DESCONECTADA,
        ultimoError: 'Cuenta desvinculada manualmente.',
      },
    });
    return { ok: true };
  }

  async activeAccounts() {
    return this.prisma.cuentaCorreo.findMany({
      where: { estado: MailboxStatus.CONECTADA, refreshTokenCifrado: { not: null } },
      orderBy: { direccion: 'asc' },
    });
  }

  /**
   * Devuelve un access token fresco. Si Google revocó el permiso, marca la
   * cuenta como desconectada para que el panel pida reconectarla.
   */
  async accessTokenFor(account: Prisma.CuentaCorreoGetPayload<object>): Promise<string> {
    const refreshToken = open(
      {
        ciphertext: account.refreshTokenCifrado || undefined,
        iv: account.refreshTokenIv || undefined,
        tag: account.refreshTokenTag || undefined,
      },
      this.encryptionKey,
    );
    if (!refreshToken) {
      await this.markDisconnected(account.id, 'No se pudo descifrar la credencial guardada.');
      throw new GoogleTokenRevokedError('La credencial guardada no se puede descifrar.');
    }
    try {
      const tokens = await this.oauth.refreshAccessToken(refreshToken);
      return tokens.accessToken;
    } catch (error) {
      if (error instanceof GoogleTokenRevokedError) {
        await this.markDisconnected(account.id, 'Google revocó la autorización. Vuelve a conectar la cuenta.');
      }
      throw error;
    }
  }

  async markDisconnected(id: string, reason: string) {
    await this.prisma.cuentaCorreo.update({
      where: { id },
      data: { estado: MailboxStatus.DESCONECTADA, ultimoError: reason.slice(0, 500) },
    });
  }

  async markSuccess(id: string, historyId: string | null, processed: number) {
    await this.prisma.cuentaCorreo.update({
      where: { id },
      data: {
        ultimoHistoryId: historyId || undefined,
        ultimaSincronizacion: new Date(),
        ultimoError: null,
        erroresConsecutivos: 0,
        correosProcesados: { increment: processed },
      },
    });
  }

  /** A los 10 fallos seguidos la cuenta se pausa para dejar de gastar llamadas. */
  async markFailure(id: string, message: string) {
    const account = await this.prisma.cuentaCorreo.update({
      where: { id },
      data: { ultimoError: message.slice(0, 500), erroresConsecutivos: { increment: 1 } },
      select: { erroresConsecutivos: true, direccion: true },
    });
    if (account.erroresConsecutivos >= MAX_CONSECUTIVE_ERRORS) {
      await this.prisma.cuentaCorreo.update({ where: { id }, data: { estado: MailboxStatus.PAUSADA } });
      this.logger.warn(`Cuenta ${account.direccion} pausada tras ${account.erroresConsecutivos} fallos seguidos.`);
    }
  }
}
