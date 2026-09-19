import {
  buildState,
  isUsableKey,
  MAILBOX_KEY_MIN_LENGTH,
  open,
  readState,
  safeEquals,
  seal,
  STATE_TTL_MS,
} from './mailbox-crypto';

const KEY = 'a'.repeat(MAILBOX_KEY_MIN_LENGTH);
const OTHER_KEY = 'b'.repeat(MAILBOX_KEY_MIN_LENGTH);

describe('cifrado de credenciales de correo', () => {
  it('descifra lo que cifró', () => {
    const secret = '1//04refresh-token-de-google';
    const sealed = seal(secret, KEY);
    expect(sealed.ciphertext).not.toContain('refresh');
    expect(open(sealed, KEY)).toBe(secret);
  });

  it('produce un resultado distinto cada vez aunque el texto sea el mismo', () => {
    const a = seal('mismo-token', KEY);
    const b = seal('mismo-token', KEY);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
    expect(a.iv).not.toEqual(b.iv);
    expect(open(a, KEY)).toBe(open(b, KEY));
  });

  it('no descifra con otra clave', () => {
    expect(open(seal('token', KEY), OTHER_KEY)).toBeNull();
  });

  it('rechaza un texto cifrado alterado en la base de datos', () => {
    const sealed = seal('token', KEY);
    const tampered = { ...sealed, ciphertext: Buffer.from('otro-contenido').toString('base64') };
    expect(open(tampered, KEY)).toBeNull();
  });

  it('devuelve null si faltan piezas', () => {
    expect(open({ ciphertext: 'x' }, KEY)).toBeNull();
    expect(open(null, KEY)).toBeNull();
  });

  it('exige una clave de al menos 32 caracteres', () => {
    expect(isUsableKey('corta')).toBe(false);
    expect(isUsableKey(KEY)).toBe(true);
    expect(isUsableKey(undefined)).toBe(false);
    expect(() => seal('token', 'corta')).toThrow();
    expect(open(seal('token', KEY), 'corta')).toBeNull();
  });

  it('compara en tiempo constante sin fallar por longitudes distintas', () => {
    expect(safeEquals('igual', 'igual')).toBe(true);
    expect(safeEquals('corto', 'mucho mas largo')).toBe(false);
  });
});

describe('state del flujo OAuth', () => {
  it('conserva el usuario que inició el flujo', () => {
    const state = buildState(KEY, 'usuario-1');
    expect(readState(state, KEY)?.userId).toBe('usuario-1');
  });

  it('rechaza una firma de otra clave', () => {
    expect(readState(buildState(KEY, 'usuario-1'), OTHER_KEY)).toBeNull();
  });

  it('rechaza un state manipulado', () => {
    const state = buildState(KEY, 'usuario-1');
    const [body, signature] = state.split('.');
    const forged = Buffer.from(JSON.stringify({ userId: 'intruso', issuedAt: Date.now(), nonce: 'x' })).toString('base64url');
    expect(readState(`${forged}.${signature}`, KEY)).toBeNull();
    expect(readState(`${body}.firma-falsa`, KEY)).toBeNull();
  });

  it('caduca pasados diez minutos', () => {
    const now = Date.now();
    const state = buildState(KEY, 'usuario-1', now);
    expect(readState(state, KEY, now + STATE_TTL_MS - 1_000)).not.toBeNull();
    expect(readState(state, KEY, now + STATE_TTL_MS + 1_000)).toBeNull();
  });

  it('rechaza un state emitido en el futuro', () => {
    const now = Date.now();
    expect(readState(buildState(KEY, 'usuario-1', now + 10 * 60_000), KEY, now)).toBeNull();
  });

  it('nunca repite el mismo state', () => {
    expect(buildState(KEY, 'usuario-1')).not.toEqual(buildState(KEY, 'usuario-1'));
  });

  it('rechaza entradas vacías o mal formadas', () => {
    expect(readState('', KEY)).toBeNull();
    expect(readState('sin-punto', KEY)).toBeNull();
  });
});
