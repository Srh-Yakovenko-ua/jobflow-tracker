import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '../common/clock.js';
import { DEPENDENCY_LIMITS } from '../common/probe.js';
import { MetricsRegistry } from '../metrics/metrics-registry.js';
import { memoryLog } from '../test/memory-log.js';
import { samplesOf } from '../test/metrics.js';
import { compileProcessorModule } from '../test/processor.js';
import { fixedClock, NOW } from '../test/time.js';
import { OutboxRepository } from './outbox.repository.js';
import { OutboxLagService } from './outbox-lag.service.js';

const LAG = 'jobflow_outbox_lag_seconds';

class FakeOutbox {
  oldest: () => Promise<Date | null> = () => Promise.resolve(null);

  oldestUnpublishedAt(): Promise<Date | null> {
    return this.oldest();
  }
}

const log = memoryLog();

describe('OutboxLagService', () => {
  const outbox = new FakeOutbox();
  let metrics: MetricsRegistry;

  beforeAll(async () => {
    const moduleRef = await compileProcessorModule(log.sink, [
      OutboxLagService,
      MetricsRegistry,
      { provide: OutboxRepository, useValue: outbox },
      { provide: Clock, useValue: fixedClock(NOW) },
    ]);
    metrics = moduleRef.get(MetricsRegistry);
  });

  beforeEach(() => {
    log.lines.length = 0;
  });

  it('reads 42 when the oldest unpublished row was created 42 s ago', async () => {
    outbox.oldest = () => Promise.resolve(new Date(NOW.getTime() - 42_000));

    expect(await samplesOf(metrics, LAG)).toEqual([{ labels: {}, value: 42 }]);
  });

  it('reads 0 when no row waits', async () => {
    outbox.oldest = () => Promise.resolve(null);

    expect(await samplesOf(metrics, LAG)).toEqual([{ labels: {}, value: 0 }]);
  });

  it.each([
    { postgres: 'refuses', answer: () => Promise.reject(new Error('Connection refused')) },
    { postgres: 'never answers', answer: () => new Promise<never>(() => undefined) },
  ])(
    'drops the sample and warns when Postgres $postgres, and the scrape still resolves',
    { timeout: DEPENDENCY_LIMITS.queryTimeoutMs + 2000 },
    async ({ answer }) => {
      outbox.oldest = () => Promise.resolve(new Date(NOW.getTime() - 5000));
      await samplesOf(metrics, LAG);
      outbox.oldest = answer;

      expect(await samplesOf(metrics, LAG)).toEqual([]);
      expect(log.parsed()).toEqual([
        expect.objectContaining({ level: 40, msg: 'outbox lag not measured' }),
      ]);
    },
  );
});
