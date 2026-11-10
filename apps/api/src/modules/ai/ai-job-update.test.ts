import { jobUpdatedSchema } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { AI_JOB_ID, VACANCY_JOB } from '../../test/ai.js';
import { APPLICATION_ID } from '../../test/service-fixtures.js';
import { jobUpdateOf } from './ai-job-update.js';

const JOB = { ...VACANCY_JOB, applicationId: APPLICATION_ID };

const UPDATE = { id: AI_JOB_ID, kind: 'vacancy_parse', applicationId: APPLICATION_ID };

describe('jobUpdateOf', () => {
  it('reports a started job as processing at step 2 without an error', () => {
    expect(jobUpdatedSchema.parse(jobUpdateOf({ job: JOB, status: 'processing' }))).toEqual({
      ...UPDATE,
      status: 'processing',
      step: 2,
      errorType: null,
    });
  });

  it('reports a finished job as done at step 3', () => {
    expect(jobUpdateOf({ job: JOB, status: 'done' })).toEqual({
      ...UPDATE,
      status: 'done',
      step: 3,
      errorType: null,
    });
  });

  it('reports a failed job with its error type at the step it had reached', () => {
    expect(jobUpdateOf({ job: JOB, status: 'failed', errorType: 'budget_exceeded' })).toEqual({
      ...UPDATE,
      status: 'failed',
      step: 2,
      errorType: 'budget_exceeded',
    });
  });

  it('reports no application for a job that belongs to none', () => {
    expect(jobUpdateOf({ job: VACANCY_JOB, status: 'done' }).applicationId).toBeNull();
  });
});
