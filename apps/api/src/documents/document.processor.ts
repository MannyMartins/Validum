import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma.module';
import { DocumentAiService } from './document-ai.service';
import { StorageService } from './storage.service';
@Processor('document-processing')
export class DocumentProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private ai: DocumentAiService,
    private storage: StorageService,
  ) { super(); }
  async process(job: Job<{ documentId: string }>) {
    const document = await this.prisma.document.findUniqueOrThrow({ where: { id: job.data.documentId } });
    await this.prisma.document.update({ where: { id: document.id }, data: { status: 'PROCESSING' } });
    try {
      const asset = await this.storage.get(document.storageKey);
      const result = await this.ai.extract(asset.body, asset.contentType || document.contentType);
      await this.prisma.document.update({ where: { id: document.id }, data: { status: result.confidence >= 0.8 ? 'PROCESSED' : 'REVIEW_REQUIRED', extractedText: result.text, extraction: result as never } });
    } catch (error) {
      await this.prisma.document.update({ where: { id: document.id }, data: { status: 'FAILED' } });
      throw error;
    }
  }
}
