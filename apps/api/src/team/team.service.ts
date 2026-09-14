import { ForbiddenException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../auth/mail.service';
import { PrismaService } from '../common/prisma.module';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService, private auth: AuthService, private mail: MailService) {}
  private assertManager(role: string) { if (!['owner', 'admin'].includes(role)) throw new ForbiddenException('No tienes permiso para administrar usuarios.'); }

  async list(organizationId: string, currentUserId: string, currentRole: string) {
    const rows = await this.prisma.organizationMember.findMany({ where: { organizationId }, include: { user: true }, orderBy: { createdAt: 'desc' } });
    return { organizationId, currentUserId, currentRole, members: rows.map((row) => ({ organizationId, userId: row.userId,
      fullName: row.user.fullName || row.invitedEmail || row.user.email.split('@')[0], email: row.user.email, role: row.role,
      status: row.status, active: row.active, invitedAt: row.invitedAt?.toISOString(), acceptedAt: row.acceptedAt?.toISOString(),
      revokedAt: row.revokedAt?.toISOString(), isCurrentUser: row.userId === currentUserId })) };
  }

  async invite(organizationId: string, managerRole: string, input: { fullName: string; email: string; role: string }) {
    this.assertManager(managerRole);
    const email = input.email.trim().toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email } });
    const wasExisting = Boolean(user);
    if (!user) user = await this.prisma.user.create({ data: { email, fullName: input.fullName.trim(), active: false,
      passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12) } });
    else if (input.fullName.trim() && user.fullName !== input.fullName.trim()) user = await this.prisma.user.update({ where: { id: user.id }, data: { fullName: input.fullName.trim() } });

    await this.prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId, userId: user.id } },
      update: { role: input.role, active: user.active, status: user.active ? 'active' : 'invited', invitedEmail: email,
        invitedAt: new Date(), revokedAt: null },
      create: { organizationId, userId: user.id, role: input.role, active: user.active,
        status: user.active ? 'active' : 'invited', invitedEmail: email, invitedAt: new Date(), acceptedAt: user.active ? new Date() : null },
    });
    if (!user.active) {
      const token = await this.auth.issuePasswordToken(user.id, 'invite');
      await this.mail.sendPasswordLink(email, user.fullName || 'Usuario', token, 'invite');
    }
    return { invitationWasSent: !user.active, message: wasExisting && user.active ? 'La cuenta existente fue vinculada.' : 'Invitación enviada.' };
  }

  async revoke(organizationId: string, managerId: string, managerRole: string, userId: string) {
    this.assertManager(managerRole);
    if (managerId === userId) throw new ForbiddenException('No puedes revocar tu propia sesión.');
    const target = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
    if (!target || target.role === 'owner') throw new ForbiddenException('No se puede revocar al propietario.');
    await this.prisma.organizationMember.update({ where: { organizationId_userId: { organizationId, userId } },
      data: { active: false, status: 'revoked', revokedAt: new Date() } });
    return { success: true };
  }

  async changeRole(organizationId: string, managerRole: string, userId: string, role: string) {
    this.assertManager(managerRole);
    const target = await this.prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
    if (!target || target.role === 'owner') throw new ForbiddenException('No se puede modificar al propietario.');
    await this.prisma.organizationMember.update({ where: { organizationId_userId: { organizationId, userId } }, data: { role } });
    return { success: true };
  }
}
