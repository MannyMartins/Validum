import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.module';
import { AuditService } from '../audit/audit.service';
import { StorageService } from './storage.service';
@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService, private storage: StorageService, private audit: AuditService, @InjectQueue('document-processing') private queue: Queue) {}
  async ingest(input: { caseId: string; originalName: string; contentType: string; body: Buffer; sourceMessageId?: string }) {
    const storageKey = `cases/${input.caseId}/${randomUUID()}-${input.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    await this.storage.put(storageKey, input.body, input.contentType);
    const document = await this.prisma.document.create({ data: { caseId: input.caseId, originalName: input.originalName, contentType: input.contentType, storageKey, sourceMessageId: input.sourceMessageId, status: 'STORED' } });
    await this.queue.add('extract', { documentId: document.id }, { attempts: 3, backoff: { type: 'exponential', delay: 3000 } });
    await this.audit.log({ action: 'document.ingested', entityType: 'Document', entityId: document.id, metadata: { caseId: input.caseId } });
    return document;
  }
  listForCase(caseId: string) { return this.prisma.document.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' } }); }
}
