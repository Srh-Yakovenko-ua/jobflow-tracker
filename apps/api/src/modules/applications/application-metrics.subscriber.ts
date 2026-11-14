import { Injectable, type OnModuleInit } from '@nestjs/common';
import { Counter } from 'prom-client';

import { MetricsRegistry } from '../../metrics/metrics-registry.js';
import { DomainEventRouter } from '../../outbox/domain-event-router.js';
import {
  APPLICATION_EVENTS,
  applicationCreatedPayloadSchema,
  type ApplicationStageChangedPayload,
  applicationStageChangedPayloadSchema,
} from './applications.events.js';

const LABEL = 'application metrics event';

@Injectable()
export class ApplicationMetricsSubscriber implements OnModuleInit {
  private readonly created: Counter;

  private readonly moves: Counter<'from_stage' | 'to_stage'>;

  constructor(
    private readonly events: DomainEventRouter,
    metrics: MetricsRegistry,
  ) {
    const registers = [metrics.registry];
    this.created = new Counter({
      name: 'jobflow_applications_created_total',
      help: 'Applications created',
      registers,
    });
    this.moves = new Counter({
      name: 'jobflow_stage_moves_total',
      help: 'Stage moves of applications by the stage left and the stage reached',
      labelNames: ['from_stage', 'to_stage'] as const,
      registers,
    });
  }

  onModuleInit(): void {
    this.events.subscribeParsed({
      type: APPLICATION_EVENTS.created,
      schema: applicationCreatedPayloadSchema,
      label: LABEL,
      handle: () => {
        this.created.inc();
        return Promise.resolve();
      },
    });
    this.events.subscribeParsed({
      type: APPLICATION_EVENTS.stageChanged,
      schema: applicationStageChangedPayloadSchema,
      label: LABEL,
      handle: (payload) => this.countMove(payload),
    });
  }

  private countMove({ fromStage, toStage }: ApplicationStageChangedPayload): Promise<void> {
    this.moves.inc({ from_stage: fromStage, to_stage: toStage });
    return Promise.resolve();
  }
}
