/**
 * Conversión de un mensaje crudo de la API de Gmail al formato que espera
 * la ingesta de correspondencia. Son funciones puras a propósito: toda la
 * lógica frágil (MIME anidado, base64url, HTML) queda cubierta por pruebas.
 */

export const GMAIL_BODY_LIMIT = 15_000;

export interface GmailHeader {
  name?: string;
  value?: string;
}

export interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

export interface GmailMessage {
  id?: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart;
}

export interface NormalizedMail {
  messageId: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  textPlain: string;
  fecha: string;
}

export function decodeBase64Url(data: string | undefined): string {
  if (!data) return '';
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

export function headerValue(payload: GmailPart | undefined, name: string): string {
  const target = name.toLowerCase();
  const found = payload?.headers?.find(header => String(header.name || '').toLowerCase() === target);
  return String(found?.value || '').trim();
}

/** Convierte HTML a texto legible sin arrastrar estilos, scripts ni etiquetas. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Recorre el árbol MIME buscando primero text/plain y, si no lo hay,
 * text/html convertido a texto. Ignora los adjuntos.
 */
export function extractBody(payload: GmailPart | undefined): string {
  if (!payload) return '';
  const plain: string[] = [];
  const html: string[] = [];

  const walk = (part: GmailPart | undefined, depth: number) => {
    if (!part || depth > 20) return;
    const mime = String(part.mimeType || '').toLowerCase();
    const isAttachment = Boolean(part.filename);
    if (!isAttachment && part.body?.data) {
      if (mime.startsWith('text/plain')) plain.push(decodeBase64Url(part.body.data));
      else if (mime.startsWith('text/html')) html.push(decodeBase64Url(part.body.data));
    }
    part.parts?.forEach(child => walk(child, depth + 1));
  };

  walk(payload, 0);
  const text = plain.join('\n').trim();
  if (text) return text;
  const converted = htmlToText(html.join('\n'));
  return converted;
}

/** internalDate viene en milisegundos como cadena; el header Date es el respaldo. */
export function resolveDate(message: GmailMessage, now = new Date()): string {
  const internal = Number(message.internalDate);
  if (Number.isFinite(internal) && internal > 0) {
    const fromInternal = new Date(internal);
    if (!Number.isNaN(fromInternal.getTime())) return fromInternal.toISOString();
  }
  const header = headerValue(message.payload, 'Date');
  if (header) {
    const parsed = new Date(header);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return now.toISOString();
}

export function normalizeGmailMessage(message: GmailMessage, now = new Date()): NormalizedMail {
  const payload = message.payload;
  const body = extractBody(payload) || String(message.snippet || '');
  const to = [headerValue(payload, 'To'), headerValue(payload, 'Cc')].filter(Boolean).join(', ');
  return {
    messageId: String(message.id || '').trim(),
    threadId: String(message.threadId || '').trim(),
    from: headerValue(payload, 'From'),
    to,
    subject: headerValue(payload, 'Subject'),
    textPlain: body.slice(0, GMAIL_BODY_LIMIT),
    fecha: resolveDate(message, now),
  };
}
