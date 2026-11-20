import type { AiJobStatus, ApplicationCard } from '@jobflow/shared';

export type DraftState = 'parsing' | 'review' | 'failed' | 'none';

export type DraftSource = Pick<ApplicationCard, 'isDraft' | 'aiStatus'>;

export type DraftLink = DraftSource & Pick<ApplicationCard, 'id' | 'aiJobId'>;

export const REVIEW_ANCHOR = '#review';

export const FOLLOW_UP_ANCHOR = 'follow-up';

const DRAFT_STATE: Record<AiJobStatus, DraftState> = {
  queued: 'parsing',
  processing: 'parsing',
  done: 'review',
  failed: 'failed',
};

export function draftStateOf({ isDraft, aiStatus }: DraftSource): DraftState {
  return isDraft && aiStatus !== null ? DRAFT_STATE[aiStatus] : 'none';
}

export function applicationHrefOf(id: string, anchor?: typeof FOLLOW_UP_ANCHOR): string {
  const path = `/applications/${id}`;
  return anchor === undefined ? path : `${path}#${anchor}`;
}

export function cardHrefOf(card: DraftLink): string {
  const state = draftStateOf(card);
  if (state === 'review') return `/add?review=${card.id}${REVIEW_ANCHOR}`;
  if (state === 'failed' && card.aiJobId !== null) {
    return `/add?review=${card.id}&job=${card.aiJobId}${REVIEW_ANCHOR}`;
  }
  return applicationHrefOf(card.id);
}

export function cardLinkOf(card: DraftLink) {
  const href = cardHrefOf(card);
  return { href, scroll: href.endsWith(REVIEW_ANCHOR), prefetch: false } as const;
}
