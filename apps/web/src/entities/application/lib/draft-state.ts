import type { AiJobStatus, ApplicationCard } from '@jobflow/shared';

export type DraftState = 'parsing' | 'review' | 'failed' | 'none';

export type DraftSource = Pick<ApplicationCard, 'isDraft' | 'aiStatus'>;

export type DraftLink = DraftSource & Pick<ApplicationCard, 'id' | 'aiJobId'>;

const DRAFT_STATE: Record<AiJobStatus, DraftState> = {
  queued: 'parsing',
  processing: 'parsing',
  done: 'review',
  failed: 'failed',
};

export function draftStateOf({ isDraft, aiStatus }: DraftSource): DraftState {
  return isDraft && aiStatus !== null ? DRAFT_STATE[aiStatus] : 'none';
}

export function cardHrefOf(card: DraftLink): string {
  const state = draftStateOf(card);
  if (state === 'review') return `/add?review=${card.id}#review`;
  if (state === 'failed' && card.aiJobId !== null) {
    return `/add?review=${card.id}&job=${card.aiJobId}#review`;
  }
  return `/applications/${card.id}`;
}
