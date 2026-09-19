import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';

@Injectable()
export class CorrespondenceApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = (this.config.get<string>('CORRESPONDENCIA_INGEST_API_KEY') || '').trim();
    const providedHeader = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>()
      .headers['x-api-key'];
    const provided = (Array.isArray(providedHeader) ? providedHeader[0] : providedHeader || '').trim();
    if (!expected || !provided) throw new UnauthorizedException('Credencial de ingesta inválida.');

    const expectedHash = createHash('sha256').update(expected).digest();
    const providedHash = createHash('sha256').update(provided).digest();
    if (!timingSafeEqual(expectedHash, providedHash)) {
      throw new UnauthorizedException('Credencial de ingesta inválida.');
    }
    return true;
  }
}
