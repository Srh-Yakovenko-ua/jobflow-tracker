import { Injectable, type OnModuleInit } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import { APPLICATION_EVENTS, applicationStageChangedPayloadSchema } from '../applications/index.js';
import { SETTINGS_EVENTS, settingsChangedPayloadSchema } from '../settings/index.js';
import { RemindersService } from './reminders.service.js';
import { SilenceScanService } from './silence-scan.service.js';

const REMINDERS_LABEL = 'reminders event';

@Injectable()
export class RemindersSubscriber implements OnModuleInit {
  constructor(
    private readonly events: DomainEventRouter,
    private readonly reminders: RemindersService,
    private readonly silence: SilenceScanService,
    private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: APPLICATION_EVENTS.stageChanged,
      schema: applicationStageChangedPayloadSchema,
      label: REMINDERS_LABEL,
      handle: ({ userId, applicationId }) => this.reminders.resolveFollowups(userId, applicationId),
    });
    this.events.subscribeParsed({
      type: SETTINGS_EVENTS.changed,
      schema: settingsChangedPayloadSchema,
      label: REMINDERS_LABEL,
      handle: ({ userId, fields }) =>
        fields.includes('silenceDays')
          ? this.silence.startSilence(userId, this.clock.now())
          : Promise.resolve(),
    });
  }
}
