import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const MAILBOX_KEY_MIN_LENGTH = 32;

export interface SealedSecret {
  ciphertext: string;
  iv: string;
  tag: string;
}

/**
 * Deriva una clave AES-256 de 32 bytes a partir del secreto configurado.
 * El secreto nunca se usa tal cual ni se registra en ningún log.
 */
export function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function isUsableKey(secret: string | undefined | null): boolean {
  return typeof secret === 'string' && secret.trim().length >= MAILBOX_KEY_MIN_LENGTH;
}

/**
 * Cifra un secreto con AES-256-GCM. Cada llamada usa un IV aleatorio distinto,
 * así que dos cifrados del mismo texto nunca producen el mismo resultado.
 */
export function seal(plaintext: string, secret: string): SealedSecret {
  if (!isUsableKey(secret)) {
    throw new Error('La clave de cifrado de cuentas de correo no está configurada correctamente.');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

/**
 * Descifra y verifica la etiqueta de autenticación. Si el dato fue alterado
 * en la base de datos, GCM falla y devolvemos null en lugar de datos corruptos.
 */
export function open(sealed: Partial<SealedSecret> | null | undefined, secret: string): string | null {
  if (!sealed?.ciphertext || !sealed.iv || !sealed.tag || !isUsableKey(secret)) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(sealed.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

/** Compara dos cadenas en tiempo constante, sin filtrar su longitud. */
export function safeEquals(a: string, b: string): boolean {
  const left = createHash('sha256').update(a, 'utf8').digest();
  const right = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(left, right);
}

/** Ventana de validez del `state` de OAuth: suficiente para autorizar, corta para replicar. */
export const STATE_TTL_MS = 10 * 60 * 1_000;

export interface OAuthState {
  /** Usuario que inició el flujo, para que el callback no acepte a un tercero. */
  userId: string | null;
  /** Momento de emisión, en milisegundos. */
  issuedAt: number;
  /** Valor aleatorio que hace irrepetible cada `state`. */
  nonce: string;
}

export function signState(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('base64url');
}

/**
 * El `state` viaja por el navegador, así que va firmado con HMAC: el callback
 * puede confirmar que lo emitimos nosotros sin guardar nada en memoria.
 */
export function buildState(secret: string, userId: string | null, now = Date.now()): string {
  const payload: OAuthState = { userId, issuedAt: now, nonce: randomBytes(18).toString('base64url') };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${signState(body, secret)}`;
}

export function readState(state: string, secret: string, now = Date.now()): OAuthState | null {
  const [body, signature] = String(state || '').split('.');
  if (!body || !signature || !isUsableKey(secret)) return null;
  if (!safeEquals(signature, signState(body, secret))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthState;
    if (!parsed || typeof parsed.issuedAt !== 'number') return null;
    if (now - parsed.issuedAt > STATE_TTL_MS || parsed.issuedAt > now + 60_000) return null;
    return parsed;
  } catch {
    return null;
  }
}
