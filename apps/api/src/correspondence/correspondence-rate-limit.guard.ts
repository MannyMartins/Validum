import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class CorrespondenceRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private readonly limit = 120;
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ ip?: string; socket?: { remoteAddress?: string } }>();
    const key = request.ip || request.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      this.cleanup(now);
      return true;
    }
    if (current.count >= this.limit) {
      throw new HttpException('Límite de ingesta excedido. Intenta nuevamente en un minuto.', HttpStatus.TOO_MANY_REQUESTS);
    }
    current.count += 1;
    return true;
  }

  private cleanup(now: number) {
    if (this.buckets.size < 1_000) return;
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
  }
}
