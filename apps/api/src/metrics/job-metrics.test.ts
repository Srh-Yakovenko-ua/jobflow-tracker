import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { beforeAll, describe, expect, it } from 'vitest';

import { metricLinesOf } from '../test/metrics.js';
import { FakeHost, FakeWorker, hostOf } from '../test/worker-hosts.js';
import { JobMetrics } from './job-metrics.js';
import { MetricsRegistry } from './metrics-registry.js';

class AiHost extends FakeHost {}

class PushHost extends FakeHost {}

const workers = { ai: new FakeWorker('ai'), push: new FakeWorker('push') };

const timedJob = (seconds: number) => ({ processedOn: 1_000, finishedOn: 1_000 + seconds * 1000 });

describe('jobflow_job_duration_seconds', () => {
  let metrics: MetricsRegistry;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [
        JobMetrics,
        MetricsRegistry,
        { provide: AiHost, useValue: hostOf(workers.ai, new AiHost()) },
        { provide: PushHost, useValue: hostOf(workers.push, new PushHost()) },
      ],
    }).compile();
    await moduleRef.init();
    metrics = moduleRef.get(MetricsRegistry);
  });

  it('observes the run time of completed and failed jobs per queue and skips a failed event without a job', async () => {
    workers.ai.emit('completed', timedJob(1.5));
    workers.ai.emit('failed', timedJob(0.25), new Error('AI service answered 503'));
    workers.ai.emit('failed', undefined, new Error('job stalled more than allowable limit'));
    workers.push.emit('completed', timedJob(2));

    expect(await metricLinesOf(metrics, 'jobflow_job_duration_seconds')).toEqual(
      expect.arrayContaining([
        'jobflow_job_duration_seconds_sum{queue="ai",status="completed"} 1.5',
        'jobflow_job_duration_seconds_count{queue="ai",status="completed"} 1',
        'jobflow_job_duration_seconds_sum{queue="ai",status="failed"} 0.25',
        'jobflow_job_duration_seconds_count{queue="ai",status="failed"} 1',
        'jobflow_job_duration_seconds_sum{queue="push",status="completed"} 2',
        'jobflow_job_duration_seconds_count{queue="push",status="completed"} 1',
      ]),
    );
  });
});
