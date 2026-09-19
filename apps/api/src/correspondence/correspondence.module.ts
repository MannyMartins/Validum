import { Module } from '@nestjs/common';
import { CorrespondenceApiKeyGuard } from './correspondence-api-key.guard';
import { CorrespondenceController } from './correspondence.controller';
import { IngestPayloadPipe } from './correspondence.dto';
import { CorrespondenceService } from './correspondence.service';
import { CorrespondenceRateLimitGuard } from './correspondence-rate-limit.guard';

@Module({
  controllers: [CorrespondenceController],
  providers: [CorrespondenceService, CorrespondenceApiKeyGuard, CorrespondenceRateLimitGuard, IngestPayloadPipe],
})
export class CorrespondenceModule {}
