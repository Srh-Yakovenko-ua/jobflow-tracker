import { Module } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { EventsModule } from '../events/index.js';
import { RemindersModule } from '../reminders/index.js';
import { CalendarController } from './calendar.controller.js';
import { CalendarService } from './calendar.service.js';
import { ScheduledEventEffects } from './scheduled-event-effects.js';
import { ScheduledEventsController } from './scheduled-events.controller.js';
import { ScheduledEventsRepository } from './scheduled-events.repository.js';
import { ScheduledEventsService } from './scheduled-events.service.js';

@Module({
  imports: [EventsModule, RemindersModule],
  controllers: [ScheduledEventsController, CalendarController],
  providers: [
    ScheduledEventsService,
    ScheduledEventEffects,
    CalendarService,
    ScheduledEventsRepository,
    Clock,
  ],
})
export class ScheduleModule {}
