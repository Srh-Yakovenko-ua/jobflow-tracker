import { describe, expect, it } from 'vitest';

import { cvHintsJob, EMPTY_CV_HINTS, NO_CV_HINTS, READY_CV_HINTS } from '@/test/cv-hints-fixtures';

import { cvHintsViewOf } from './cv-hints-view';

describe('cvHintsViewOf', () => {
  it('with no hints and no job asks for the first hints', () => {
    expect(cvHintsViewOf({ response: NO_CV_HINTS, refused: false })).toEqual({ kind: 'idle' });
  });

  it.each(['queued', 'processing'] as const)('a %s job waits', (status) => {
    expect(cvHintsViewOf({ response: cvHintsJob(status), refused: false })).toEqual({
      kind: 'waiting',
    });
  });

  it('done hints show with their gaps', () => {
    expect(cvHintsViewOf({ response: READY_CV_HINTS, refused: false })).toEqual({
      kind: 'ready',
      result: READY_CV_HINTS.result,
    });
  });

  it('done with no hints is still a result, not a request', () => {
    expect(cvHintsViewOf({ response: EMPTY_CV_HINTS, refused: false })).toMatchObject({
      kind: 'ready',
    });
  });

  it.each([
    { errorType: 'ai_timeout' as const, timeout: true },
    { errorType: 'ai_unavailable' as const, timeout: false },
  ])('a job failed with $errorType says whether the model timed out', ({ errorType, timeout }) => {
    expect(cvHintsViewOf({ response: cvHintsJob('failed', errorType), refused: false })).toEqual({
      kind: 'failed',
      timeout,
    });
  });

  it('a refused request, such as the hourly AI limit, fails without a timeout', () => {
    expect(cvHintsViewOf({ response: NO_CV_HINTS, refused: true })).toEqual({
      kind: 'failed',
      timeout: false,
    });
  });
});
