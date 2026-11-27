import { describe, expect, it } from 'vitest';

import {
  FAILED_AFTER_DRAFT,
  followupJob,
  NO_FOLLOWUP,
  READY_FOLLOWUP,
} from '@/test/followup-fixtures';

import { followupViewOf } from './followup-view';

const READY_KEY = '2026-11-12T09:00:00.000Z';

describe('followupViewOf', () => {
  it('a failed variant keeps the last good draft on screen with the timeout failure', () => {
    const view = followupViewOf({ response: FAILED_AFTER_DRAFT, manual: false, refused: false });

    expect(view).toMatchObject({ kind: 'ready', key: READY_KEY, failure: { reason: 'timeout' } });
  });

  it('a refused regenerate keeps the last good draft with the plain failure', () => {
    const view = followupViewOf({ response: READY_FOLLOWUP, manual: false, refused: true });

    expect(view).toMatchObject({ kind: 'ready', key: READY_KEY, failure: { reason: 'other' } });
  });

  it('«Написати вручну» after a failed variant opens the last good draft as an own text', () => {
    const view = followupViewOf({ response: FAILED_AFTER_DRAFT, manual: true, refused: false });

    expect(view).toMatchObject({ kind: 'ready', key: READY_KEY, own: true, failure: null });
  });

  it('a failure with no draft keeps the failed view', () => {
    const view = followupViewOf({
      response: followupJob('failed', 'ai_timeout'),
      manual: false,
      refused: false,
    });

    expect(view).toEqual({ kind: 'failed', reason: 'timeout' });
  });

  it('a job failed on the daily AI budget opens an empty own text with the budget line, not the failed view', () => {
    const view = followupViewOf({
      response: followupJob('failed', 'budget_exceeded'),
      manual: false,
      refused: false,
    });

    expect(view).toEqual({
      kind: 'ready',
      draft: { subject: '', body: '' },
      key: 'own',
      own: true,
      failure: { reason: 'budget' },
    });
  });

  it('a variant refused by the budget keeps the last good draft as own text with the budget line', () => {
    const { job } = followupJob('failed', 'budget_exceeded');
    const response = { ...READY_FOLLOWUP, job };
    const view = followupViewOf({ response, manual: false, refused: false });

    expect(view).toMatchObject({
      kind: 'ready',
      key: READY_KEY,
      own: true,
      failure: { reason: 'budget' },
    });
  });

  it('a per-minute 429 does not say the daily limit is spent', () => {
    const view = followupViewOf({
      response: NO_FOLLOWUP,
      manual: false,
      refused: false,
      limited: true,
    });

    expect(view).toEqual({ kind: 'failed', reason: 'rateLimited' });
  });

  it('a row the queue stopped on a 429 shows its draft with no failure once a retry brought one', () => {
    const view = followupViewOf({
      response: READY_FOLLOWUP,
      manual: false,
      refused: false,
      limited: true,
    });

    expect(view).toMatchObject({ kind: 'ready', key: READY_KEY, own: false, failure: null });
  });

  it('a done draft carries no failure', () => {
    const view = followupViewOf({ response: READY_FOLLOWUP, manual: false, refused: false });

    expect(view).toMatchObject({ kind: 'ready', own: false, failure: null });
  });
});
