import { describe, expect, it } from 'vitest';

import { JOB_ID } from '@/test/job-fixtures';

import { FULL_CARD } from '../model/card-specimens';
import { cardHrefOf, draftStateOf } from './draft-state';

describe('draftStateOf', () => {
  it.each([
    { isDraft: true, aiStatus: 'queued', state: 'parsing' },
    { isDraft: true, aiStatus: 'processing', state: 'parsing' },
    { isDraft: true, aiStatus: 'done', state: 'review' },
    { isDraft: true, aiStatus: 'failed', state: 'failed' },
    { isDraft: true, aiStatus: null, state: 'none' },
    { isDraft: false, aiStatus: 'failed', state: 'none' },
    { isDraft: false, aiStatus: 'queued', state: 'none' },
    { isDraft: false, aiStatus: 'processing', state: 'none' },
    { isDraft: false, aiStatus: 'done', state: 'none' },
  ] as const)(
    'a card with isDraft $isDraft and AI status $aiStatus reads as $state',
    ({ state, ...card }) => {
      expect(draftStateOf(card)).toBe(state);
    },
  );
});

describe('cardHrefOf', () => {
  it('a draft whose parse is done opens the review on the add page', () => {
    expect(cardHrefOf({ ...FULL_CARD, isDraft: true, aiStatus: 'done' })).toBe(
      '/add?review=0b6f3c1e-5d2a-4c8e-9f10-000000000001#review',
    );
  });

  it('a draft whose parse failed opens the failure flow on the add page with its job', () => {
    const failed = { isDraft: true, aiStatus: 'failed', aiJobId: JOB_ID } as const;

    expect(cardHrefOf({ ...FULL_CARD, ...failed })).toBe(
      '/add?review=0b6f3c1e-5d2a-4c8e-9f10-000000000001&job=0199f1a0-3c4d-7e5f-8a6b-7c8d9e0f1a2b#review',
    );
  });

  it.each([
    { isDraft: true, aiStatus: 'processing' },
    { isDraft: true, aiStatus: 'failed', aiJobId: null },
    { isDraft: false, aiStatus: 'failed', aiJobId: JOB_ID },
    { isDraft: false, aiStatus: 'done' },
  ] as const)('a card with isDraft $isDraft and AI status $aiStatus opens its own page', (card) => {
    expect(cardHrefOf({ ...FULL_CARD, ...card })).toBe(
      '/applications/0b6f3c1e-5d2a-4c8e-9f10-000000000001',
    );
  });
});
