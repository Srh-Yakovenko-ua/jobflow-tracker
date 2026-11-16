import { Module } from '@nestjs/common';

import { AnalyticsClientModule } from '../../analytics-client/index.js';
import { Clock } from '../../common/clock.js';
import { OutboxWorkerModule } from '../../outbox/outbox.module.js';
import { EventsModule } from '../events/index.js';
import { NotificationsModule } from '../notifications/index.js';
import { RhythmController } from './rhythm.controller.js';
import { RhythmRepository } from './rhythm.repository.js';
import { RhythmService } from './rhythm.service.js';
import { RhythmSubscriber } from './rhythm.subscriber.js';
import { RhythmRequestsService } from './rhythm-requests.service.js';
import { RhythmWeekCloseService } from './rhythm-week-close.service.js';

@Module({
  imports: [EventsModule],
  controllers: [RhythmController],
  providers: [Clock, RhythmRepository, RhythmService, RhythmRequestsService],
  exports: [RhythmRequestsService, RhythmService, RhythmRepository],
})
export class RhythmModule {}

@Module({
  imports: [RhythmModule, OutboxWorkerModule, AnalyticsClientModule, NotificationsModule],
  providers: [RhythmWeekCloseService, RhythmSubscriber],
})
export class RhythmWorkerModule {}
