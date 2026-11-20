import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { AiModule } from '../ai/index.js';
import { LiveModule } from '../live/index.js';
import { SettingsModule } from '../settings/index.js';
import { AiNotificationsSubscriber } from './ai-notifications.subscriber.js';
import { InsightSubscriber } from './insight.subscriber.js';
import { NotificationScheduleService } from './notification-schedule.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsSubscriber } from './notifications.subscriber.js';
import { SummaryNotificationsSubscriber } from './summary-notifications.subscriber.js';

@Module({
  imports: [SettingsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsRepository, NotificationScheduleService, Clock],
  exports: [NotificationsService, NotificationScheduleService],
})
export class NotificationsModule {}

@Module({
  imports: [OutboxWorkerModule, LiveModule, AiModule, NotificationsModule],
  providers: [
    NotificationsSubscriber,
    AiNotificationsSubscriber,
    InsightSubscriber,
    SummaryNotificationsSubscriber,
    NotificationsRepository,
  ],
})
export class NotificationsWorkerModule {}
