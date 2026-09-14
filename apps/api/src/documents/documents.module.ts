import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { StorageService } from './storage.service';
import { DocumentProcessor } from './document.processor';
import { DocumentAiService } from './document-ai.service';
@Module({
  imports: [BullModule.registerQueue({ name: 'document-processing' })],
  controllers: [DocumentsController],
  providers: [DocumentsService, StorageService, DocumentProcessor, DocumentAiService],
  exports: [DocumentsService, StorageService],
})
export class DocumentsModule {}
