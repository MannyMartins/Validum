import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma.module';
import { DocumentAiService } from './document-ai.service';
@Processor('document-processing')
export class DocumentProcessor extends WorkerHost {
  constructor(private prisma: PrismaService, private ai: DocumentAiService) { super(); }
  async process(job: Job<{ documentId: string }>) {
    const document = await this.prisma.document.findUniqueOrThrow({ where: { id: job.data.documentId } });
    await this.prisma.document.update({ where: { id: document.id }, data: { status: 'PROCESSING' } });
    // Retrieval from object storage belongs here before a production AI provider is enabled.
    const result = await this.ai.extract(Buffer.alloc(0), document.contentType);
    await this.prisma.document.update({ where: { id: document.id }, data: { status: result.confidence >= 0.8 ? 'PROCESSED' : 'REVIEW_REQUIRED', extractedText: result.text, extraction: result as never } });
  }
}
