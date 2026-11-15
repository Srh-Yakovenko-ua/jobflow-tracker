import { describe, expect, it } from 'vitest';

import { CV_HINTS_OUTPUT } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { cvHintsResponseSchema } from './cv-hints.js';

const RESULT = { ...CV_HINTS_OUTPUT, generatedAt: '2026-11-15T10:00:00.000Z' };

const JOB_ID = '01920000-0000-7000-8000-000000000090';

describe('cvHintsResponseSchema', () => {
  it.for([
    { label: 'no hints and no job yet', body: { result: null, job: null } },
    {
      label: 'a queued job',
      body: { result: null, job: { id: JOB_ID, status: 'queued', errorType: null } },
    },
    {
      label: 'a job failed on a services/ai timeout',
      body: { result: null, job: { id: JOB_ID, status: 'failed', errorType: 'ai_timeout' } },
    },
    {
      label: 'ready hints beside their done job',
      body: { result: RESULT, job: { id: JOB_ID, status: 'done', errorType: null } },
    },
  ])('accepts $label', ({ body }) => {
    expect(cvHintsResponseSchema.parse(body)).toEqual(body);
  });

  it.for([
    {
      label: 'hints without their generation time',
      body: { result: CV_HINTS_OUTPUT, job: null },
      path: 'result.generatedAt',
    },
    {
      label: 'a job without its error type',
      body: { result: null, job: { id: JOB_ID, status: 'failed' } },
      path: 'job.errorType',
    },
    {
      label: 'a job in an unknown state',
      body: { result: null, job: { id: JOB_ID, status: 'paused', errorType: null } },
      path: 'job.status',
    },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(cvHintsResponseSchema.safeParse(body))).toEqual([path]);
  });
});
