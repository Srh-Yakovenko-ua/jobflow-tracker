import { buildJobStatus } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { aiJobOf } from './ai-job';

describe('aiJobOf', () => {
  it.for([
    {
      name: 'a queued job with its place in the queue reads as queued',
      job: buildJobStatus({ status: 'queued', queue: { ahead: 1, etaSeconds: 30 } }),
      expected: { status: 'queued', ahead: 1, etaSeconds: 30 },
    },
    {
      name: 'a queued job with no queue reads as processing at the queued step',
      job: buildJobStatus({ status: 'queued', step: 1, queue: null }),
      expected: { status: 'processing', step: 1, steps: 3 },
    },
    {
      name: 'a processing job keeps its step',
      job: buildJobStatus({ status: 'processing', step: 2, queue: null }),
      expected: { status: 'processing', step: 2, steps: 3 },
    },
    {
      name: 'a job not read yet reads as processing at the queued step',
      job: undefined,
      expected: { status: 'processing', step: 1, steps: 3 },
    },
  ])('$name', ({ job, expected }) => {
    expect(aiJobOf(job)).toEqual(expected);
  });
});
