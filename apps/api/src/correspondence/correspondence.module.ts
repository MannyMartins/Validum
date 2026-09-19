import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CorrespondenceApiKeyGuard } from './correspondence-api-key.guard';
import { CorrespondenceController } from './correspondence.controller';
import { IngestPayloadPipe } from './correspondence.dto';
import { CorrespondenceService } from './correspondence.service';
import { CorrespondenceRateLimitGuard } from './correspondence-rate-limit.guard';
import { GmailClientService } from './mailbox/gmail-client.service';
import { GoogleOAuthService } from './mailbox/google-oauth.service';
import { MailClassifierService } from './mailbox/mail-classifier.service';
import { MailSyncProcessor, MAIL_SYNC_QUEUE } from './mailbox/mail-sync.processor';
import { MailSyncService } from './mailbox/mail-sync.service';
import { MailboxController } from './mailbox/mailbox.controller';
import { MailboxService } from './mailbox/mailbox.service';

@Module({
  imports: [BullModule.registerQueue({ name: MAIL_SYNC_QUEUE })],
  controllers: [MailboxController, CorrespondenceController],
  providers: [
    CorrespondenceService,
    CorrespondenceApiKeyGuard,
    CorrespondenceRateLimitGuard,
    IngestPayloadPipe,
    GoogleOAuthService,
    GmailClientService,
    MailClassifierService,
    MailboxService,
    MailSyncService,
    MailSyncProcessor,
  ],
})
export class CorrespondenceModule {}
