import { Injectable, Logger } from '@nestjs/common';
import { Gauge } from 'prom-client';

import { Clock } from '../common/clock.js';
import { errorMessageOf } from '../common/error-message.js';
import { DEPENDENCY_LIMITS, withinLimit } from '../common/probe.js';
import { MetricsRegistry } from '../metrics/metrics-registry.js';
import { OutboxRepository } from './outbox.repository.js';

const MS_PER_SECOND = 1000;

const secondsBetween = (earlier: Date, later: Date) =>
  (later.getTime() - earlier.getTime()) / MS_PER_SECOND;

@Injectable()
export class OutboxLagService {
  private readonly logger = new Logger(OutboxLagService.name);

  private readonly gauge: Gauge;

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly clock: Clock,
    metrics: MetricsRegistry,
  ) {
    this.gauge = new Gauge({
      name: 'jobflow_outbox_lag_seconds',
      help: 'Seconds the oldest unpublished outbox row has waited, 0 when none waits',
      registers: [metrics.registry],
      collect: () => this.measure(),
    });
  }

  private async measure(): Promise<void> {
    try {
      const oldest = await withinLimit(
        this.outbox.oldestUnpublishedAt(),
        DEPENDENCY_LIMITS.queryTimeoutMs,
      );
      this.gauge.set(oldest === null ? 0 : secondsBetween(oldest, this.clock.now()));
    } catch (error) {
      this.gauge.remove({});
      this.logger.warn({ err: errorMessageOf(error) }, 'outbox lag not measured');
    }
  }
}
