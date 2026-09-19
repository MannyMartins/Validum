import { CanActivate, ExecutionContext, Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';

@Injectable()
export class CorrespondenceApiKeyGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(CorrespondenceApiKeyGuard.name);
  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.expectedKey().length < 32) {
      this.logger.warn('La ingesta de correspondencia está deshabilitada: configura una API key de al menos 32 caracteres.');
    }
  }

  private expectedKey(): string {
    return (this.config.get<string>('CORRESPONDENCIA_INGEST_API_KEY') || '').trim();
  }

  canActivate(context: ExecutionContext): boolean {
    const expected = this.expectedKey();
    const providedHeader = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>()
      .headers['x-api-key'];
    const provided = (Array.isArray(providedHeader) ? providedHeader[0] : providedHeader || '').trim();
    if (expected.length < 32 || !provided) throw new UnauthorizedException('Credencial de ingesta inválida.');

    const expectedHash = createHash('sha256').update(expected).digest();
    const providedHash = createHash('sha256').update(provided).digest();
    if (!timingSafeEqual(expectedHash, providedHash)) {
      throw new UnauthorizedException('Credencial de ingesta inválida.');
    }
    return true;
  }
}
