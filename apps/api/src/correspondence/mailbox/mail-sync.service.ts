import { Injectable, Logger } from '@nestjs/common';
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
const FIRST_LOAD_QUERY = 'newer_than:1d -in:chats';

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
    const accounts = await this.mailboxes.activeAccounts();
    if (!accounts.length) return [];
    const results: SyncOutcome[] = [];
    for (const account of accounts) {
      try {
        results.push(await this.syncAccount(account));
      } catch (error) {
        const message = (error as Error).message || 'Error desconocido.';
        // El mensaje se guarda para el panel, pero nunca el contenido del correo.
        if (!(error instanceof GoogleTokenRevokedError)) {
          await this.mailboxes.markFailure(account.id, message);
        }
        this.logger.warn(`Fallo al sincronizar ${account.direccion}: ${message}`);
        results.push({ cuenta: account.direccion, nuevos: 0, omitidos: 0, error: message });
      }
    }
    return results;
  }

  async syncAccount(account: CuentaCorreo): Promise<SyncOutcome> {
    const accessToken = await this.mailboxes.accessTokenFor(account);
    const max = this.maxPerCycle;
    let messageIds: string[] = [];
    let nextHistoryId: string | null = null;

    if (account.ultimoHistoryId) {
      try {
        const page = await this.gmail.listHistory(accessToken, account.ultimoHistoryId, max);
        messageIds = page.messageIds;
        nextHistoryId = page.historyId;
      } catch (error) {
        if (!(error instanceof GmailHistoryGoneError)) throw error;
        // El historyId caducó: recargamos una ventana reciente para no perder correos.
        this.logger.warn(`historyId caducado en ${account.direccion}; recargando ventana reciente.`);
        messageIds = await this.gmail.listRecentMessages(accessToken, FIRST_LOAD_QUERY, max);
        nextHistoryId = (await this.gmail.getProfile(accessToken)).historyId;
      }
    } else {
      messageIds = await this.gmail.listRecentMessages(accessToken, FIRST_LOAD_QUERY, max);
      nextHistoryId = (await this.gmail.getProfile(accessToken)).historyId;
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

    await this.mailboxes.markSuccess(account.id, nextHistoryId, nuevos);
    return { cuenta: account.direccion, nuevos, omitidos };
  }

  /** Vuelve a pasar por el modelo un correo marcado con error de clasificación. */
  async reclassify(id: string) {
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
