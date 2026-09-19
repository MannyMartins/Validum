import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CuentaCorreo } from '@prisma/client';
import { PrismaService } from '../../common/prisma.module';
import { CorrespondenceService } from '../correspondence.service';
import { GmailClientService, GmailHistoryGoneError } from './gmail-client.service';
import { normalizeGmailMessage } from './gmail-message';
import { GoogleTokenRevokedError } from './google-oauth.service';
import { MailClassifierService } from './mail-classifier.service';
import { MailboxService } from './mailbox.service';

const DEFAULT_MAX_PER_CYCLE = 50;

export interface SyncOutcome {
  cuenta: string;
  nuevos: number;
  omitidos: number;
  error?: string;
}

@Injectable()
export class MailSyncService {
  private readonly logger = new Logger(MailSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailboxes: MailboxService,
    private readonly gmail: GmailClientService,
    private readonly classifier: MailClassifierService,
    private readonly correspondence: CorrespondenceService,
  ) {}

  private get maxPerCycle(): number {
    const raw = Number(this.config.get('CORRESPONDENCIA_MAX_POR_CICLO'));
    return Number.isInteger(raw) && raw > 0 && raw <= 500 ? raw : DEFAULT_MAX_PER_CYCLE;
  }

  /**
   * Un ciclo completo sobre todas las cuentas conectadas. El fallo de una
   * cuenta nunca detiene a las demás.
   */
  async runCycle(): Promise<SyncOutcome[]> {
    this.assertEnabled();
    const accounts = await this.mailboxes.activeAccounts();
    if (!accounts.length) return [];
    const results: SyncOutcome[] = [];
    for (const account of accounts) {
      try {
        results.push(await this.syncAccount(account));
      } catch (error) {
        const message = error instanceof GoogleTokenRevokedError
          ? 'Google revocó la autorización. Vuelve a conectar la cuenta.'
          : 'No se pudo sincronizar el buzón. Reintenta o comprueba su configuración.';
        // El mensaje se guarda para el panel, pero nunca el contenido del correo.
        if (!(error instanceof GoogleTokenRevokedError)) {
          await this.mailboxes.markFailure(account.id, message);
        }
        this.logger.warn(message);
        results.push({ cuenta: account.direccion, nuevos: 0, omitidos: 0, error: message });
      }
    }
    return results;
  }

  async syncAccount(account: CuentaCorreo): Promise<SyncOutcome> {
    this.assertEnabled();
    const accessToken = await this.mailboxes.accessTokenFor(account);
    const max = this.maxPerCycle;
    let messageIds: string[] = [];
    let nextHistoryId: string | null = null;
    const isKnown = async (messageId: string) => Boolean(await this.prisma.correoClasificado.findUnique({
      where: { cuentaDestino_gmailMessageId: { cuentaDestino: account.direccion, gmailMessageId: messageId } },
      select: { id: true },
    }));
    const loadSnapshot = async () => {
      // Capture the history boundary BEFORE listing, so mail arriving during
      // enumeration remains discoverable in the next incremental cycle.
      const baseline = (await this.gmail.getProfile(accessToken)).historyId;
      const since = account.ultimaSincronizacion || account.creadoEn;
      const after = Math.floor((since.getTime() - 86_400_000) / 1000);
      const page = await this.gmail.listRecentMessages(accessToken, `after:${after} -in:chats`, max, isKnown);
      messageIds = page.messageIds;
      nextHistoryId = page.complete ? baseline : null;
    };

    if (account.ultimoHistoryId) {
      try {
        const page = await this.gmail.listHistory(accessToken, account.ultimoHistoryId, max, isKnown);
        messageIds = page.messageIds;
        nextHistoryId = page.historyId;
      } catch (error) {
        if (!(error instanceof GmailHistoryGoneError)) throw error;
        // El historyId caducó: recargamos una ventana reciente para no perder correos.
        this.logger.warn('historyId caducado; recuperando desde la última sincronización.');
        await loadSnapshot();
      }
    } else {
      await loadSnapshot();
    }

    let nuevos = 0;
    let omitidos = 0;
    for (const messageId of messageIds.slice(0, max)) {
      // Comprobar antes de llamar al modelo evita pagar dos veces por el mismo correo.
      const already = await this.prisma.correoClasificado.findUnique({
        where: {
          cuentaDestino_gmailMessageId: { cuentaDestino: account.direccion, gmailMessageId: messageId },
        },
        select: { id: true },
      });
      if (already) {
        omitidos += 1;
        continue;
      }
      const raw = await this.gmail.getMessage(accessToken, messageId);
      const mail = normalizeGmailMessage(raw);
      if (!mail.messageId) {
        omitidos += 1;
        continue;
      }
      const classification = await this.classifier.classify(mail);
      await this.correspondence.ingest({
        ...mail,
        cuenta_origen: account.direccion,
        ...classification,
      });
      nuevos += 1;
    }

    // A partial snapshot must retain its original recovery window as well.
    await this.mailboxes.markSuccess(account.id, nextHistoryId, nuevos,
      nextHistoryId !== null && nextHistoryId !== account.ultimoHistoryId);
    return { cuenta: account.direccion, nuevos, omitidos };
  }

  private assertEnabled() {
    if (this.config.get('CORRESPONDENCIA_POLL_ENABLED') !== 'true') {
      throw new ServiceUnavailableException('Lectura de Gmail desactivada. El modo de prueba solo permite correos ficticios.');
    }
  }

  /** Vuelve a pasar por el modelo un correo marcado con error de clasificación. */
  async reclassify(id: string) {
    if (this.config.get('CORRESPONDENCIA_GEMINI_REAL_ENABLED') !== 'true' || !this.classifier.isConfigured()) {
      throw new ServiceUnavailableException('La clasificación de correos reales está desactivada o no configurada.');
    }
    const stored = await this.prisma.correoClasificado.findUnique({ where: { id } });
    if (!stored) return null;
    const classification = await this.classifier.classify({
      messageId: stored.gmailMessageId,
      threadId: stored.gmailThreadId,
      from: stored.remitenteCorreo,
      to: stored.destinatarios || stored.cuentaDestino,
      subject: stored.asunto,
      textPlain: stored.cuerpo,
      fecha: stored.fechaRecepcion.toISOString(),
    });
    await this.correspondence.ingest({
      messageId: stored.gmailMessageId,
      threadId: stored.gmailThreadId,
      from: stored.remitenteCorreo,
      to: stored.destinatarios || stored.cuentaDestino,
      subject: stored.asunto,
      textPlain: stored.cuerpo,
      fecha: stored.fechaRecepcion.toISOString(),
      cuenta_origen: stored.cuentaDestino,
      ...classification,
    });
    return this.correspondence.detail(id);
  }
}
