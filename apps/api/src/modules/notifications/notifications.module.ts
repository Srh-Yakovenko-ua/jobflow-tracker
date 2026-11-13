import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { AiModule } from '../ai/index.js';
import { LiveModule } from '../live/index.js';
import { AiNotificationsSubscriber } from './ai-notifications.subscriber.js';
import { InsightSubscriber } from './insight.subscriber.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsSubscriber } from './notifications.subscriber.js';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository, Clock],
  exports: [NotificationsService],
})
export class NotificationsModule {}

@Module({
  imports: [OutboxWorkerModule, LiveModule, AiModule, NotificationsModule],
  providers: [
    NotificationsSubscriber,
    AiNotificationsSubscriber,
    InsightSubscriber,
    NotificationsRepository,
  ],
})
export class NotificationsWorkerModule {}
