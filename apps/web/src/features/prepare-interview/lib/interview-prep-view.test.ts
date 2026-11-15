import { describe, expect, it } from 'vitest';

import {
  interviewPrepJob,
  NO_INTERVIEW_PREP,
  READY_INTERVIEW_PREP,
} from '@/test/interview-prep-fixtures';

import { interviewPrepViewOf } from './interview-prep-view';

describe('interviewPrepViewOf', () => {
  it('with no pack and no job asks for the first pack', () => {
    expect(interviewPrepViewOf({ response: NO_INTERVIEW_PREP, refusal: 'none' })).toEqual({
      kind: 'idle',
    });
  });

  it('a done pack shows', () => {
    expect(interviewPrepViewOf({ response: READY_INTERVIEW_PREP, refusal: 'none' })).toEqual({
      kind: 'ready',
      result: READY_INTERVIEW_PREP.result,
    });
  });

  it('a queued job waits', () => {
    expect(interviewPrepViewOf({ response: interviewPrepJob('queued'), refusal: 'none' })).toEqual({
      kind: 'waiting',
    });
  });

  it('a request refused because there is nothing to build from says so, even over an old pack', () => {
    expect(interviewPrepViewOf({ response: READY_INTERVIEW_PREP, refusal: 'unbuildable' })).toEqual(
      { kind: 'unbuildable' },
    );
  });

  it('any other refused request, such as the hourly AI limit, fails without a timeout', () => {
    expect(interviewPrepViewOf({ response: NO_INTERVIEW_PREP, refusal: 'other' })).toEqual({
      kind: 'failed',
      timeout: false,
    });
  });

  it('a job failed on the 30 second limit says the model timed out', () => {
    expect(
      interviewPrepViewOf({ response: interviewPrepJob('failed', 'ai_timeout'), refusal: 'none' }),
    ).toEqual({ kind: 'failed', timeout: true });
  });
});
