import { Injectable, Logger } from '@nestjs/common';
import { GmailMessage } from './gmail-message';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export class GmailHistoryGoneError extends Error {
  constructor() {
    super('El historyId guardado ya no es válido; hay que resincronizar desde cero.');
    this.name = 'GmailHistoryGoneError';
  }
}

export interface HistoryPage {
  messageIds: string[];
  historyId: string | null;
}

@Injectable()
export class GmailClientService {
  private readonly logger = new Logger(GmailClientService.name);

  /** Dirección real del buzón autorizado, según Google y no según lo que diga el usuario. */
  async getProfile(accessToken: string): Promise<{ emailAddress: string; historyId: string | null }> {
    const data = await this.request<{ emailAddress?: string; historyId?: string }>('/profile', accessToken);
    return {
      emailAddress: String(data.emailAddress || '').trim().toLowerCase(),
      historyId: data.historyId ? String(data.historyId) : null,
    };
  }

  /**
   * Sincronización incremental. Google responde 404 cuando el historyId es
   * demasiado antiguo; en ese caso avisamos para que el llamador haga una
   * carga completa acotada en lugar de perder correos en silencio.
   */
  async listHistory(accessToken: string, startHistoryId: string, max: number): Promise<HistoryPage> {
    const ids = new Set<string>();
    let pageToken: string | undefined;
    let latestHistoryId: string | null = null;

    do {
      const params = new URLSearchParams({
        startHistoryId,
        historyTypes: 'messageAdded',
        maxResults: '100',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const data = await this.request<{
        history?: { messagesAdded?: { message?: { id?: string; labelIds?: string[] } }[] }[];
        historyId?: string;
        nextPageToken?: string;
      }>(`/history?${params.toString()}`, accessToken, { notFoundIsHistoryGone: true });

      if (data.historyId) latestHistoryId = String(data.historyId);
      for (const entry of data.history || []) {
        for (const added of entry.messagesAdded || []) {
          const id = added.message?.id;
          const labels = added.message?.labelIds || [];
          // Los borradores y lo que Google ya marcó como spam no son correspondencia.
          if (!id || labels.includes('DRAFT') || labels.includes('SPAM') || labels.includes('TRASH')) continue;
          ids.add(id);
          if (ids.size >= max) return { messageIds: [...ids], historyId: latestHistoryId };
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return { messageIds: [...ids], historyId: latestHistoryId };
  }

  /** Carga inicial acotada: solo la ventana reciente, nunca la bandeja entera. */
  async listRecentMessages(accessToken: string, query: string, max: number): Promise<string[]> {
    const params = new URLSearchParams({ q: query, maxResults: String(Math.min(max, 100)) });
    const data = await this.request<{ messages?: { id?: string }[] }>(
      `/messages?${params.toString()}`,
      accessToken,
    );
    return (data.messages || []).map(message => String(message.id || '')).filter(Boolean).slice(0, max);
  }

  async getMessage(accessToken: string, id: string): Promise<GmailMessage> {
    return this.request<GmailMessage>(`/messages/${encodeURIComponent(id)}?format=full`, accessToken);
  }

  /**
   * Reintentos con espera exponencial ante 429 y 5xx, que es lo que Google
   * devuelve cuando hay que bajar el ritmo.
   */
  private async request<T>(
    path: string,
    accessToken: string,
    options: { notFoundIsHistoryGone?: boolean; attempt?: number } = {},
  ): Promise<T> {
    const attempt = options.attempt || 0;
    const response = await fetch(`${GMAIL_API}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.ok) return (await response.json()) as T;

    if (response.status === 404 && options.notFoundIsHistoryGone) throw new GmailHistoryGoneError();

    const retriable = response.status === 429 || response.status >= 500;
    if (retriable && attempt < 3) {
      const waitMs = 500 * 2 ** attempt;
      this.logger.warn(`Gmail respondió ${response.status}; reintentando en ${waitMs} ms.`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return this.request<T>(path, accessToken, { ...options, attempt: attempt + 1 });
    }

    // Nunca incluimos el cuerpo de la respuesta: puede traer datos del correo.
    throw new Error(`Gmail respondió ${response.status} al consultar ${path.split('?')[0]}.`);
  }
}
