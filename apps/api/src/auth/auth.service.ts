import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../common/prisma.module';
import { MailService } from './mail.service';

export interface SessionPayload {
  sub: string;
  email: string;
  role: string;
  organizationId: string;
  membershipRole: string;
  tokenVersion: number;
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private mail: MailService) {}

  private async ensureMembership(user: { id: string; email: string; fullName: string | null }) {
    const existing = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id, active: true }, include: { organization: true },
    });
    if (existing) return existing;
    if (await this.prisma.organizationMember.findFirst({ where: { userId: user.id } })) {
      throw new UnauthorizedException('El acceso de este usuario fue revocado.');
    }
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { name: user.fullName?.trim() || 'Validum', createdBy: user.id } });
      const membership = await tx.organizationMember.create({
        data: { organizationId: organization.id, userId: user.id, role: 'owner', status: 'active', active: true, acceptedAt: new Date() },
        include: { organization: true },
      });
      await tx.userPreference.upsert({
        where: { userId: user.id }, update: { organizationId: organization.id }, create: { userId: user.id, organizationId: organization.id },
      });
      await tx.workspaceState.create({ data: { organizationId: organization.id } });
      return membership;
    });
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user?.active || !(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Credenciales no válidas.');
    const membership = await this.ensureMembership(user);
    const payload: SessionPayload = {
      sub: user.id, email: user.email, role: user.role, organizationId: membership.organizationId,
      membershipRole: membership.role, tokenVersion: user.tokenVersion,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, email: user.email, fullName: user.fullName || user.email.split('@')[0], role: membership.role,
        organizationId: membership.organizationId, organizationName: membership.organization.name },
    };
  }

  async me(payload: SessionPayload) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: payload.organizationId, userId: payload.sub } },
      include: { user: true, organization: true },
    });
    if (!membership?.active || !membership.user.active) throw new UnauthorizedException();
    return { id: membership.user.id, email: membership.user.email,
      fullName: membership.user.fullName || membership.user.email.split('@')[0], role: membership.role,
      organizationId: membership.organizationId, organizationName: membership.organization.name };
  }

  async issuePasswordToken(userId: string, kind: 'invite' | 'recovery'): Promise<string> {
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + (kind === 'invite' ? 48 : 1) * 60 * 60 * 1000);
    await this.prisma.$transaction([
      this.prisma.authToken.deleteMany({ where: { userId, kind, usedAt: null } }),
      this.prisma.authToken.create({ data: { userId, kind, tokenHash, expiresAt } }),
    ]);
    return rawToken;
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user?.active) return;
    const token = await this.issuePasswordToken(user.id, 'recovery');
    await this.mail.sendPasswordLink(user.email, user.fullName || 'Usuario', token, 'recovery');
  }

  async completePasswordSetup(token: string, password: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.prisma.authToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!record || record.usedAt || record.expiresAt <= new Date()) throw new UnauthorizedException('El enlace es inválido o ya expiró.');
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.authToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) throw new UnauthorizedException('El enlace es inválido o ya fue utilizado.');
      await tx.user.update({ where: { id: record.userId },
        data: { passwordHash, active: true, tokenVersion: { increment: 1 } } });
      await tx.organizationMember.updateMany({ where: { userId: record.userId, status: 'invited' },
        data: { status: 'active', active: true, acceptedAt: new Date() } });
    });
    return this.login(record.user.email, password);
  }
}
