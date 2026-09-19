import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CorrespondenceApiKeyGuard } from './correspondence-api-key.guard';

function context(apiKey?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: apiKey ? { 'x-api-key': apiKey } : {} }) }),
  } as unknown as ExecutionContext;
}

describe('CorrespondenceApiKeyGuard', () => {
  const validKey = 'a'.repeat(32);
  it('rechaza la ingesta si la variable no está configurada', () => {
    const guard = new CorrespondenceApiKeyGuard({ get: () => undefined } as unknown as ConfigService);
    expect(() => guard.canActivate(context('cualquier-clave'))).toThrow(UnauthorizedException);
  });

  it('rechaza una clave incorrecta', () => {
    const guard = new CorrespondenceApiKeyGuard({ get: () => validKey } as unknown as ConfigService);
    expect(() => guard.canActivate(context('clave-incorrecta'))).toThrow(UnauthorizedException);
  });

  it('rechaza una solicitud sin cabecera aunque la variable esté configurada', () => {
    const guard = new CorrespondenceApiKeyGuard({ get: () => validKey } as unknown as ConfigService);
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
  });

  it('rechaza una clave configurada con menos de 32 caracteres', () => {
    const guard = new CorrespondenceApiKeyGuard({ get: () => 'demasiado-corta' } as unknown as ConfigService);
    expect(() => guard.canActivate(context('demasiado-corta'))).toThrow(UnauthorizedException);
  });

  it('acepta una clave correcta', () => {
    const guard = new CorrespondenceApiKeyGuard({ get: () => validKey } as unknown as ConfigService);
    expect(guard.canActivate(context(validKey))).toBe(true);
  });
});
