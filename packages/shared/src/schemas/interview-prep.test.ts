import { describe, expect, it } from 'vitest';

import { INTERVIEW_PREP_OUTPUT } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { interviewPrepResponseSchema } from './interview-prep.js';

const GENERATED_AT = '2026-11-15T10:00:00.000Z';

const DONE_JOB = { id: '01920000-0000-7000-8000-000000000091', status: 'done', errorType: null };

describe('interviewPrepResponseSchema', () => {
  it('accepts a ready pack beside its done job', () => {
    const body = { result: { ...INTERVIEW_PREP_OUTPUT, generatedAt: GENERATED_AT }, job: DONE_JOB };
    expect(interviewPrepResponseSchema.parse(body)).toEqual(body);
  });

  it('accepts no pack and no job yet', () => {
    expect(interviewPrepResponseSchema.parse({ result: null, job: null })).toEqual({
      result: null,
      job: null,
    });
  });

  it.for([
    {
      label: 'a pack without its generation time',
      body: { result: INTERVIEW_PREP_OUTPUT, job: DONE_JOB },
      path: 'result.generatedAt',
    },
    {
      label: 'a pack with 9 practice questions',
      body: {
        result: {
          ...INTERVIEW_PREP_OUTPUT,
          questions: INTERVIEW_PREP_OUTPUT.questions.slice(1),
          generatedAt: GENERATED_AT,
        },
        job: DONE_JOB,
      },
      path: 'result.questions',
    },
  ])('refuses $label at $path', ({ body, path }) => {
    expect(issuePathsOf(interviewPrepResponseSchema.safeParse(body))).toEqual([path]);
  });
});
