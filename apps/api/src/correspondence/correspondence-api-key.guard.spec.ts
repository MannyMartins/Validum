import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CorrespondenceApiKeyGuard } from './correspondence-api-key.guard';

function context(apiKey?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: apiKey ? { 'x-api-key': apiKey } : {} }) }),
  } as unknown as ExecutionContext;
}

describe('CorrespondenceApiKeyGuard', () => {
  it('rechaza la ingesta si la variable no está configurada', () => {
    const guard = new CorrespondenceApiKeyGuard({ get: () => undefined } as unknown as ConfigService);
    expect(() => guard.canActivate(context('cualquier-clave'))).toThrow(UnauthorizedException);
  });

  it('rechaza una clave incorrecta', () => {
    const guard = new CorrespondenceApiKeyGuard({ get: () => 'clave-correcta' } as unknown as ConfigService);
    expect(() => guard.canActivate(context('clave-incorrecta'))).toThrow(UnauthorizedException);
  });

  it('acepta una clave correcta', () => {
    const guard = new CorrespondenceApiKeyGuard({ get: () => 'clave-correcta' } as unknown as ConfigService);
    expect(guard.canActivate(context('clave-correcta'))).toBe(true);
  });
});
