import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { JwtKeysModule } from '../auth/index.js';
import { NotificationsModule } from '../notifications/index.js';
import { SettingsModule } from '../settings/index.js';
import { SummariesModule } from '../summaries/index.js';
import { EmailController } from './email.controller.js';
import { EmailProcessor } from './email.processor.js';
import { EmailRepository } from './email.repository.js';
import { EmailSubscriber } from './email.subscriber.js';
import { EmailComposeService } from './email-compose.service.js';
import { EmailDeliveryService } from './email-delivery.service.js';
import { EmailSendService } from './email-send.service.js';
import { EmailSender } from './email-sender.js';
import { EmailUnsubscribeService } from './email-unsubscribe.service.js';
import { UnsubscribeTokens } from './unsubscribe-tokens.js';

@Module({
  imports: [SettingsModule, JwtKeysModule],
  controllers: [EmailController],
  providers: [EmailUnsubscribeService, UnsubscribeTokens],
})
export class EmailModule {}

@Module({
  imports: [
    OutboxWorkerModule,
    SettingsModule,
    NotificationsModule,
    SummariesModule,
    JwtKeysModule,
  ],
  providers: [
    Clock,
    EmailRepository,
    EmailSender,
    UnsubscribeTokens,
    EmailComposeService,
    EmailSubscriber,
    EmailDeliveryService,
    EmailSendService,
    EmailProcessor,
  ],
})
export class EmailWorkerModule {}
