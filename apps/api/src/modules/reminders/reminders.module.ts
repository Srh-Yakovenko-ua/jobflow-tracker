import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { EventsModule } from '../events/index.js';
import { SettingsModule } from '../settings/index.js';
import { InterviewAlertsRepository } from './interview-alerts.repository.js';
import { InterviewAlertsService } from './interview-alerts.service.js';
import { RemindersController } from './reminders.controller.js';
import { RemindersRepository } from './reminders.repository.js';
import { RemindersService } from './reminders.service.js';
import { RemindersSubscriber } from './reminders.subscriber.js';
import { SilenceRepository } from './silence.repository.js';
import { SilenceScanService } from './silence-scan.service.js';

@Module({
  imports: [EventsModule, SettingsModule],
  controllers: [RemindersController],
  providers: [
    RemindersService,
    RemindersRepository,
    SilenceScanService,
    SilenceRepository,
    InterviewAlertsService,
    InterviewAlertsRepository,
    Clock,
  ],
  exports: [RemindersService, SilenceScanService, InterviewAlertsService],
})
export class RemindersModule {}

@Module({
  imports: [OutboxWorkerModule, RemindersModule],
  providers: [RemindersSubscriber, Clock],
})
export class RemindersWorkerModule {}
