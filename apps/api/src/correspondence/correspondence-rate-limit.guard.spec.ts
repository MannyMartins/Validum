import { ExecutionContext, HttpException } from '@nestjs/common';
import { CorrespondenceRateLimitGuard } from './correspondence-rate-limit.guard';

const context = {
  switchToHttp: () => ({ getRequest: () => ({ ip: '203.0.113.10' }) }),
} as unknown as ExecutionContext;

describe('CorrespondenceRateLimitGuard', () => {
  it('permite 120 solicitudes por minuto y rechaza la siguiente', () => {
    const guard = new CorrespondenceRateLimitGuard();
    for (let index = 0; index < 120; index += 1) expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });
});
