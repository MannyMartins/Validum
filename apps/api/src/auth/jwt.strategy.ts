import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../common/prisma.module';
import { SessionPayload } from './auth.service';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) { super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: config.getOrThrow<string>('JWT_SECRET') }); }
  async validate(payload: SessionPayload) {
    const [user, membership] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: payload.sub } }),
      this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: payload.organizationId, userId: payload.sub } } }),
    ]);
    if (!user?.active || user.tokenVersion !== payload.tokenVersion || !membership?.active) throw new UnauthorizedException();
    return { ...payload, membershipRole: membership.role };
  }
}
