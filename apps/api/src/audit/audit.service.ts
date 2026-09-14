import { Injectable } from '@nestjs/common';
import { Channel } from '@prisma/client';
import { PrismaService } from '../common/prisma.module';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  log(input: { action: string; entityType: string; entityId: string; actorId?: string; channel?: Channel; metadata?: object }) {
    return this.prisma.auditLog.create({ data: { ...input, metadata: input.metadata as never } });
  }
}
