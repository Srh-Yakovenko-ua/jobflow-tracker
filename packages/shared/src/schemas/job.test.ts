import { describe, expect, it } from 'vitest';

import { buildJobStatus } from '../../testing/index.js';
import { AI_JOB_FAILURES, AI_JOB_STEPS } from '../ai-statuses.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { jobStatusSchema, jobUpdatedSchema } from './job.js';

describe('AI_JOB_STEPS', () => {
  it('numbers queued, processing and done as steps 1, 2 and 3 of 3', () => {
    expect(AI_JOB_STEPS).toEqual({ queued: 1, processing: 2, done: 3, total: 3 });
  });
});

describe('AI_JOB_FAILURES', () => {
  it('names the error types a failed job answers besides the parse failures', () => {
    expect(AI_JOB_FAILURES).toEqual({
      budgetExceeded: 'budget_exceeded',
      timeout: 'ai_timeout',
      notReady: 'not_ready',
      providerError: 'ai_provider_error',
      rateLimited: 'rate_limited',
      invalidOutput: 'ai_invalid_output',
    });
  });
});

describe('jobStatusSchema', () => {
  it.each([
    { label: 'a queued job with its queue position and ETA', job: buildJobStatus() },
    {
      label: 'a job created before steps were stored, at step 0',
      job: buildJobStatus({ step: 0 }),
    },
    {
      label: 'a done job at step 3 with no queue',
      job: buildJobStatus({ status: 'done', step: 3, queue: null }),
    },
    {
      label: 'a failed job with its error type',
      job: buildJobStatus({
        status: 'failed',
        step: 2,
        queue: null,
        errorType: 'budget_exceeded',
      }),
    },
    { label: 'a job with no application', job: buildJobStatus({ applicationId: null }) },
  ])('accepts $label unchanged', ({ job }) => {
    expect(jobStatusSchema.parse(job)).toEqual(job);
  });

  it.each([
    { label: 'step 4', patch: { step: 4 }, path: 'step' },
    { label: 'a negative step', patch: { step: -1 }, path: 'step' },
    { label: 'a fractional step', patch: { step: 1.5 }, path: 'step' },
    { label: 'a step total other than 3', patch: { totalSteps: 4 }, path: 'totalSteps' },
    { label: 'an unknown status', patch: { status: 'cancelled' }, path: 'status' },
    { label: 'an id that is not a uuid', patch: { id: '76' }, path: 'id' },
    { label: 'a missing queue', patch: { queue: undefined }, path: 'queue' },
    {
      label: 'a negative queue position',
      patch: { queue: { ahead: -1, etaSeconds: 30 } },
      path: 'queue.ahead',
    },
    {
      label: 'a negative ETA',
      patch: { queue: { ahead: 2, etaSeconds: -1 } },
      path: 'queue.etaSeconds',
    },
  ])('refuses $label at $path', ({ patch, path }) => {
    expect(issuePathsOf(jobStatusSchema.safeParse({ ...buildJobStatus(), ...patch }))).toEqual([
      path,
    ]);
  });
});

describe('jobUpdatedSchema', () => {
  it('carries the job without the queue estimate and the step total', () => {
    expect(Object.keys(jobUpdatedSchema.shape)).toEqual([
      'id',
      'kind',
      'status',
      'step',
      'errorType',
      'applicationId',
    ]);
  });

  it('refuses step 4 at step', () => {
    expect(issuePathsOf(jobUpdatedSchema.safeParse({ ...buildJobStatus(), step: 4 }))).toEqual([
      'step',
    ]);
  });
});
