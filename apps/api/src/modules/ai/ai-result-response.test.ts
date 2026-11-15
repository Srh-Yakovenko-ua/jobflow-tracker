import { cvHintsOutputSchema } from '@jobflow/shared';
import { CV_HINTS_OUTPUT } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { AI_JOB_ID } from '../../test/ai.js';
import { minutesAfter } from '../../test/time.js';
import { aiResultResponse } from './ai-result-response.js';

const DONE = { id: AI_JOB_ID, status: 'done', errorType: null } as const;

describe('aiResultResponse', () => {
  it('answers the parsed output of a done job with the time it finished', () => {
    const latest = { ...DONE, finishedAt: minutesAfter(5), aiResult: { output: CV_HINTS_OUTPUT } };

    expect(aiResultResponse(latest, cvHintsOutputSchema)).toEqual({
      result: { ...CV_HINTS_OUTPUT, generatedAt: '2026-10-22T09:05:00.000Z' },
      job: DONE,
    });
  });

  it.each([
    { case: 'a queued job', job: { ...DONE, status: 'queued' }, finishedAt: null },
    { case: 'a processing job', job: { ...DONE, status: 'processing' }, finishedAt: null },
    {
      case: 'a failed job',
      job: { ...DONE, status: 'failed', errorType: 'ai_invalid_output' },
      finishedAt: minutesAfter(5),
    },
    { case: 'a done job whose result was deleted', job: DONE, finishedAt: minutesAfter(5) },
  ] as const)('answers $case with its job and no result', ({ job, finishedAt }) => {
    const output = job.status === 'failed' ? { output: CV_HINTS_OUTPUT } : null;

    expect(aiResultResponse({ ...job, finishedAt, aiResult: output }, cvHintsOutputSchema)).toEqual(
      {
        result: null,
        job,
      },
    );
  });

  it('answers no result and no job before the first job', () => {
    expect(aiResultResponse(undefined, cvHintsOutputSchema)).toEqual({ result: null, job: null });
  });
});
