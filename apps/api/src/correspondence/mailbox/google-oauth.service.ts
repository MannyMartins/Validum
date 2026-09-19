import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildState, isUsableKey, OAuthState, readState } from './mailbox-crypto';

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export class GoogleTokenRevokedError extends Error {
  constructor(message = 'Google revocó la autorización de esta cuenta.') {
    super(message);
    this.name = 'GoogleTokenRevokedError';
  }
}

export interface ExchangedTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresInSeconds: number;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * El módulo falla de forma cerrada: sin las tres variables y sin clave de
   * cifrado utilizable no se puede conectar ninguna cuenta.
   */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri && isUsableKey(this.stateSecret));
  }

  private get clientId(): string {
    return String(this.config.get('GOOGLE_OAUTH_CLIENT_ID') || '').trim();
  }

  private get clientSecret(): string {
    return String(this.config.get('GOOGLE_OAUTH_CLIENT_SECRET') || '').trim();
  }

  private get redirectUri(): string {
    return String(this.config.get('GOOGLE_OAUTH_REDIRECT_URI') || '').trim();
  }

  private get stateSecret(): string {
    return String(this.config.get('CORRESPONDENCIA_TOKEN_KEY') || '').trim();
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'La conexión con Google no está configurada. Revisa GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI y CORRESPONDENCIA_TOKEN_KEY.',
      );
    }
  }

  createState(userId: string | null): string {
    this.assertConfigured();
    return buildState(this.stateSecret, userId);
  }

  /** Devuelve el contenido del `state` solo si la firma es válida y no caducó. */
  verifyState(state: string): OAuthState | null {
    return this.stateSecret ? readState(state, this.stateSecret) : null;
  }

  /**
   * access_type=offline y prompt=consent son imprescindibles: sin ellos Google
   * no vuelve a entregar refresh token en autorizaciones repetidas y la cuenta
   * quedaría inservible para la sincronización automática.
   */
  buildAuthorizationUrl(state: string, loginHint?: string): string {
    this.assertConfigured();
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    if (loginHint) params.set('login_hint', loginHint);
    return `${AUTH_ENDPOINT}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<ExchangedTokens> {
    this.assertConfigured();
    const payload = await this.requestToken({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });
    if (!payload.refresh_token) {
      throw new UnauthorizedException(
        'Google no entregó un token de actualización. Revoca el acceso de la aplicación en la cuenta y vuelve a conectarla.',
      );
    }
    return {
      accessToken: String(payload.access_token || ''),
      refreshToken: String(payload.refresh_token),
      expiresInSeconds: Number(payload.expires_in) || 3_600,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<ExchangedTokens> {
    this.assertConfigured();
    const payload = await this.requestToken({
      refresh_token: refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
    });
    return {
      accessToken: String(payload.access_token || ''),
      refreshToken: payload.refresh_token ? String(payload.refresh_token) : null,
      expiresInSeconds: Number(payload.expires_in) || 3_600,
    };
  }

  private async requestToken(body: Record<string, string>): Promise<Record<string, unknown>> {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });
    const raw = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    if (!response.ok) {
      const reason = String(parsed.error || '');
      // No registramos el cuerpo: puede contener fragmentos del token.
      this.logger.warn(`Google rechazó la petición de token (${response.status}).`);
      if (reason === 'invalid_grant') throw new GoogleTokenRevokedError();
      throw new UnauthorizedException('Google rechazó la autorización de la cuenta.');
    }
    return parsed;
  }
}
