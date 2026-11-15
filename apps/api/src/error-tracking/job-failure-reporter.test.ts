import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ERROR_LEAK } from '../test/error-collector.js';
import { RecordingErrorReporter } from '../test/error-reporter.js';
import { FakeHost, FakeWorker, hostOf } from '../test/worker-hosts.js';
import { ErrorReporter } from './error-reporter.js';
import { JobFailureReporter } from './job-failure-reporter.js';

class SummariesHost extends FakeHost {}

const worker = new FakeWorker('summaries');

const FAILURE = new Error('AI service answered 503');

const FAILED_AT = Date.UTC(2026, 10, 15, 9, 30);

type FailedAttempt = { attemptsMade: number; opts: { attempts?: number }; finishedOn?: number };

const failedJob = ({ attemptsMade, opts, finishedOn }: FailedAttempt) => ({
  name: 'summary.generate',
  attemptsMade,
  opts,
  ...(finishedOn === undefined ? {} : { finishedOn }),
  data: { userId: 'user-5f3a9c0e', note: ERROR_LEAK.note },
  returnvalue: { summary: ERROR_LEAK.email },
});

describe('JobFailureReporter', () => {
  const reporter = new RecordingErrorReporter();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [
        JobFailureReporter,
        { provide: ErrorReporter, useValue: reporter },
        { provide: SummariesHost, useValue: hostOf(worker, new SummariesHost()) },
      ],
    }).compile();
    await moduleRef.init();
  });

  beforeEach(() => {
    reporter.reports.length = 0;
  });

  it('reports nothing for a failed attempt that BullMQ retries', () => {
    worker.emit('failed', failedJob({ attemptsMade: 1, opts: { attempts: 3 } }), FAILURE);
    worker.emit('failed', undefined, FAILURE);

    expect(reporter.reports).toEqual([]);
  });

  it.each([
    {
      attempt: 'the last of three attempts',
      attemptsMade: 3,
      opts: { attempts: 3 },
      failure: FAILURE,
    },
    {
      attempt: 'the only attempt of a job without retries',
      attemptsMade: 1,
      opts: {},
      failure: FAILURE,
    },
    {
      attempt: 'an unrecoverable first of three attempts',
      attemptsMade: 1,
      opts: { attempts: 3 },
      failure: new UnrecoverableError('ai_invalid_output'),
    },
  ])(
    'reports $attempt once, tagged with its queue and job name and none of its payload',
    ({ attemptsMade, opts, failure }) => {
      worker.emit('failed', failedJob({ attemptsMade, opts, finishedOn: FAILED_AT }), failure);

      expect(reporter.reports).toEqual([
        { exception: failure, tags: { queue: 'summaries', jobName: 'summary.generate' } },
      ]);
    },
  );

  it('reports nothing for a job failed for good because the AI budget is exceeded', () => {
    const refusal = new UnrecoverableError('budget_exceeded');

    worker.emit('failed', failedJob({ attemptsMade: 1, opts: {}, finishedOn: FAILED_AT }), refusal);

    expect(reporter.reports).toEqual([]);
  });
});
