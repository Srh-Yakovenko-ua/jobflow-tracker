import type { AiJobStatus, ApplicationCard } from '@jobflow/shared';

export type DraftState = 'parsing' | 'review' | 'none';

export type DraftSource = Pick<ApplicationCard, 'isDraft' | 'aiStatus'>;

const DRAFT_STATE: Record<AiJobStatus, DraftState> = {
  queued: 'parsing',
  processing: 'parsing',
  done: 'review',
  failed: 'none',
};

export function draftStateOf({ isDraft, aiStatus }: DraftSource): DraftState {
  return isDraft && aiStatus !== null ? DRAFT_STATE[aiStatus] : 'none';
}

export function cardHrefOf(card: DraftSource & Pick<ApplicationCard, 'id'>): string {
  return draftStateOf(card) === 'review'
    ? `/add?review=${card.id}#review`
    : `/applications/${card.id}`;
}
