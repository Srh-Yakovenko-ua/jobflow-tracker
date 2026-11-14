import { describe, expect, it } from 'vitest';

import { FAILED_AFTER_DRAFT, followupJob, READY_FOLLOWUP } from '@/test/followup-fixtures';

import { followupViewOf } from './followup-view';

const READY_KEY = '2026-11-12T09:00:00.000Z';

describe('followupViewOf', () => {
  it('a failed variant keeps the last good draft on screen with the timeout failure', () => {
    const view = followupViewOf({ response: FAILED_AFTER_DRAFT, manual: false, refused: false });

    expect(view).toMatchObject({ kind: 'ready', key: READY_KEY, failure: { timeout: true } });
  });

  it('a refused regenerate keeps the last good draft with the plain failure', () => {
    const view = followupViewOf({ response: READY_FOLLOWUP, manual: false, refused: true });

    expect(view).toMatchObject({ kind: 'ready', key: READY_KEY, failure: { timeout: false } });
  });

  it('«Написати самому» after a failed variant opens the last good draft as an own text', () => {
    const view = followupViewOf({ response: FAILED_AFTER_DRAFT, manual: true, refused: false });

    expect(view).toMatchObject({ kind: 'ready', key: READY_KEY, own: true, failure: null });
  });

  it('a failure with no draft keeps the failed view', () => {
    const view = followupViewOf({
      response: followupJob('failed', 'ai_timeout'),
      manual: false,
      refused: false,
    });

    expect(view).toEqual({ kind: 'failed', timeout: true });
  });

  it('a done draft carries no failure', () => {
    const view = followupViewOf({ response: READY_FOLLOWUP, manual: false, refused: false });

    expect(view).toMatchObject({ kind: 'ready', own: false, failure: null });
  });
});
