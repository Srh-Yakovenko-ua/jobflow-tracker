import { Injectable, type OnModuleInit } from '@nestjs/common';

import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { RHYTHM_EVENTS, rhythmWeekClosedPayloadSchema } from './rhythm.events.js';
import { RhythmWeekCloseService } from './rhythm-week-close.service.js';

@Injectable()
export class RhythmSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly weekClose: RhythmWeekCloseService,
  ) {}

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: RHYTHM_EVENTS.weekClosed,
      schema: rhythmWeekClosedPayloadSchema,
      label: 'rhythm event',
      handle: (closed, delivery) => this.weekClose.close(closed, delivery),
    });
  }
}
