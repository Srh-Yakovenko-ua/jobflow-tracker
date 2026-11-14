import { ConfigService } from '@nestjs/config';
import { beforeAll, describe, expect, it } from 'vitest';

import { validateEnv } from '../../config/env.js';
import { MetricsRegistry } from '../../metrics/metrics-registry.js';
import { FOLLOWUP_JOB, VACANCY_COMPLETION, VACANCY_JOB } from '../../test/ai.js';
import { exampleEnv } from '../../test/example-env.js';
import { memoryLog } from '../../test/memory-log.js';
import { samplesOf } from '../../test/metrics.js';
import { compileProcessorModule } from '../../test/processor.js';
import { AiJobRouter } from './ai-job-router.js';
import { AiMetricsSubscriber } from './ai-metrics.subscriber.js';

const PRICED_ENV = {
  ...exampleEnv,
  AI_USD_PER_MILLION_TOKENS_IN: '3',
  AI_USD_PER_MILLION_TOKENS_OUT: '15',
};

const log = memoryLog();

describe('AiMetricsSubscriber', () => {
  const metrics = new MetricsRegistry();
  let router: AiJobRouter;

  beforeAll(async () => {
    const moduleRef = await compileProcessorModule(log.sink, [
      AiJobRouter,
      AiMetricsSubscriber,
      { provide: MetricsRegistry, useValue: metrics },
      { provide: ConfigService, useValue: new ConfigService(validateEnv(PRICED_ENV)) },
    ]);
    await moduleRef.init();
    router = moduleRef.get(AiJobRouter);
  });

  it('counts settled jobs by kind and status, with the failure type of a failed one', async () => {
    await router.route({ job: VACANCY_JOB, status: 'done', output: VACANCY_COMPLETION.output });
    await router.route({ job: VACANCY_JOB, status: 'done', output: VACANCY_COMPLETION.output });
    await router.route({ job: FOLLOWUP_JOB, status: 'failed', errorType: 'budget_exceeded' });

    expect(await samplesOf(metrics, 'jobflow_ai_jobs_total')).toEqual([
      { labels: { kind: 'vacancy_parse', status: 'done', error_type: '' }, value: 2 },
      { labels: { kind: 'followup', status: 'failed', error_type: 'budget_exceeded' }, value: 1 },
    ]);
  });

  it('exports the configured USD price per million tokens in and out', async () => {
    expect(await samplesOf(metrics, 'jobflow_ai_price_usd_per_million_tokens')).toEqual([
      { labels: { direction: 'in' }, value: 3 },
      { labels: { direction: 'out' }, value: 15 },
    ]);
  });
});
