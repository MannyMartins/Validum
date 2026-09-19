import { Module } from '@nestjs/common';
import { CorrespondenceApiKeyGuard } from './correspondence-api-key.guard';
import { CorrespondenceController } from './correspondence.controller';
import { IngestPayloadPipe } from './correspondence.dto';
import { CorrespondenceService } from './correspondence.service';

@Module({
  controllers: [CorrespondenceController],
  providers: [CorrespondenceService, CorrespondenceApiKeyGuard, IngestPayloadPipe],
})
export class CorrespondenceModule {}
