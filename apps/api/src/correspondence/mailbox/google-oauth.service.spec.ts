import { GmailClientService } from './gmail-client.service';
import { GMAIL_SCOPE, GoogleOAuthService, GoogleTokenRevokedError } from './google-oauth.service';
import { MAILBOX_KEY_MIN_LENGTH } from './mailbox-crypto';

const KEY = 'k'.repeat(MAILBOX_KEY_MIN_LENGTH);

const FULL_CONFIG: Record<string, string> = {
  GOOGLE_OAUTH_CLIENT_ID: 'cliente.apps.googleusercontent.com',
  GOOGLE_OAUTH_CLIENT_SECRET: 'secreto-del-cliente',
  GOOGLE_OAUTH_REDIRECT_URI: 'https://api.example.test/api/correspondencia/cuentas/oauth/callback',
  CORRESPONDENCIA_TOKEN_KEY: KEY,
};

function build(overrides: Record<string, string | undefined> = {}) {
  const values = { ...FULL_CONFIG, ...overrides };
  return new GoogleOAuthService({ get: (name: string) => values[name] } as never);
}

function mockFetch(status: number, body: unknown) {
  global.fetch = jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  })) as never;
}

describe('configuración de OAuth', () => {
  it('se considera configurado solo con todas las variables', () => {
    expect(build().isConfigured()).toBe(true);
    expect(build({ GOOGLE_OAUTH_CLIENT_ID: '' }).isConfigured()).toBe(false);
    expect(build({ GOOGLE_OAUTH_CLIENT_SECRET: '' }).isConfigured()).toBe(false);
    expect(build({ GOOGLE_OAUTH_REDIRECT_URI: '' }).isConfigured()).toBe(false);
  });

  it('exige una clave de cifrado de al menos 32 caracteres', () => {
    expect(build({ CORRESPONDENCIA_TOKEN_KEY: 'corta' }).isConfigured()).toBe(false);
  });

  it('falla de forma cerrada si no está configurado', () => {
    const service = build({ GOOGLE_OAUTH_CLIENT_ID: '' });
    expect(() => service.createState('usuario-1')).toThrow(/no está configurada/);
  });
});

describe('URL de consentimiento', () => {
  it('pide acceso sin conexión y consentimiento explícito', () => {
    const service = build();
    const url = new URL(service.buildAuthorizationUrl(service.createState('usuario-1')));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    // Sin estos dos parámetros Google no devuelve refresh token en reautorizaciones.
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('scope')).toBe(GMAIL_SCOPE);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('pide únicamente permiso de lectura', () => {
    expect(GMAIL_SCOPE).toBe('https://www.googleapis.com/auth/gmail.readonly');
  });

  it('propone la cuenta indicada sin obligarla', () => {
    const service = build();
    const url = new URL(service.buildAuthorizationUrl(service.createState(null), 'buzon@example.test'));
    expect(url.searchParams.get('login_hint')).toBe('buzon@example.test');
  });
});

describe('validación del state', () => {
  it('acepta el suyo y rechaza uno ajeno', () => {
    const service = build();
    expect(service.verifyState(service.createState('usuario-1'))?.userId).toBe('usuario-1');
    expect(service.verifyState('inventado.firma')).toBeNull();
    expect(service.verifyState('')).toBeNull();
  });

  it('no acepta un state firmado con otra clave', () => {
    const otro = build({ CORRESPONDENCIA_TOKEN_KEY: 'z'.repeat(MAILBOX_KEY_MIN_LENGTH) });
    expect(build().verifyState(otro.createState('usuario-1'))).toBeNull();
  });
});

describe('intercambio de códigos', () => {
  afterEach(() => jest.restoreAllMocks());

  it('devuelve los tokens cuando Google responde bien', async () => {
    mockFetch(200, { access_token: 'acceso', refresh_token: 'refresco', expires_in: 3599 });
    const tokens = await build().exchangeCode('codigo');
    expect(tokens).toEqual({ accessToken: 'acceso', refreshToken: 'refresco', expiresInSeconds: 3599 });
  });

  it('avisa si Google no entrega refresh token', async () => {
    mockFetch(200, { access_token: 'acceso', expires_in: 3599 });
    await expect(build().exchangeCode('codigo')).rejects.toThrow(/token de actualización/);
  });

  it('traduce invalid_grant a autorización revocada', async () => {
    mockFetch(400, { error: 'invalid_grant' });
    await expect(build().refreshAccessToken('refresco')).rejects.toThrow(GoogleTokenRevokedError);
  });

  it('rechaza otros errores sin exponer el cuerpo', async () => {
    mockFetch(401, { error: 'invalid_client', error_description: 'secreto incorrecto' });
    await expect(build().exchangeCode('codigo')).rejects.toThrow(/rechazó la autorización/);
  });
});

describe('cliente de Gmail', () => {
  afterEach(() => jest.restoreAllMocks());

  it('normaliza la dirección del perfil a minúsculas', async () => {
    mockFetch(200, { emailAddress: 'Juridica@Example.Test', historyId: '42' });
    const profile = await new GmailClientService().getProfile('token');
    expect(profile).toEqual({ emailAddress: 'juridica@example.test', historyId: '42' });
  });
});
