import { describe, expect, it } from 'vitest';

import {
  interviewPrepJob,
  NO_INTERVIEW_PREP,
  READY_INTERVIEW_PREP,
} from '@/test/interview-prep-fixtures';

import { interviewPrepViewOf } from './interview-prep-view';

const REQUESTABLE = { refusal: 'none', requestable: true } as const;

const NOT_REQUESTABLE = { refusal: 'none', requestable: false } as const;

describe('interviewPrepViewOf', () => {
  it('with no pack and no job asks for the first pack', () => {
    expect(interviewPrepViewOf({ response: NO_INTERVIEW_PREP, ...REQUESTABLE })).toEqual({
      kind: 'idle',
    });
  });

  it('a done pack shows', () => {
    expect(interviewPrepViewOf({ response: READY_INTERVIEW_PREP, ...REQUESTABLE })).toEqual({
      kind: 'ready',
      result: READY_INTERVIEW_PREP.result,
    });
  });

  it('a queued job waits', () => {
    expect(interviewPrepViewOf({ response: interviewPrepJob('queued'), ...REQUESTABLE })).toEqual({
      kind: 'waiting',
    });
  });

  it('a request refused because there is nothing to build from says so, even over an old pack', () => {
    expect(
      interviewPrepViewOf({
        response: READY_INTERVIEW_PREP,
        refusal: 'unbuildable',
        requestable: true,
      }),
    ).toEqual({ kind: 'unbuildable' });
  });

  it('any other refused request, such as the hourly AI limit, fails without a timeout', () => {
    expect(
      interviewPrepViewOf({
        response: NO_INTERVIEW_PREP,
        refusal: 'other',
        requestable: true,
      }),
    ).toEqual({ kind: 'failed', timeout: false });
  });

  it('a job failed on the 30 second limit says the model timed out', () => {
    expect(
      interviewPrepViewOf({ response: interviewPrepJob('failed', 'ai_timeout'), ...REQUESTABLE }),
    ).toEqual({ kind: 'failed', timeout: true });
  });

  it.each([
    ['no pack', NO_INTERVIEW_PREP],
    ['a failed job', interviewPrepJob('failed', 'ai_timeout')],
  ])(
    'with %s and no planned interview says what the pack needs, with nothing to press',
    (_, response) => {
      expect(interviewPrepViewOf({ response, ...NOT_REQUESTABLE })).toEqual({
        kind: 'unbuildable',
      });
    },
  );

  it('an existing pack still shows when no interview is planned', () => {
    expect(interviewPrepViewOf({ response: READY_INTERVIEW_PREP, ...NOT_REQUESTABLE })).toEqual({
      kind: 'ready',
      result: READY_INTERVIEW_PREP.result,
    });
  });
});
