import type { ApplicationCard, RejectionReasonCode } from '@jobflow/shared';

import type { RejectionActions } from '@/features/reject-with-reason';

import { cardIn } from './board-fixtures';

export const ACME_TECH_INTERVIEW: ApplicationCard = {
  ...cardIn({ serial: 1, stage: 'tech_interview', position: 'Senior Frontend Engineer' }),
  company: 'Acme Technologies',
};

export function recordedRejectionActions() {
  const picked: RejectionReasonCode[] = [];
  const cancelled: string[] = [];
  const finished: string[] = [];
  const actions: RejectionActions = {
    onPick: (reasonCode) => picked.push(reasonCode),
    onCancel: () => cancelled.push('cancel'),
    onUndo: () => finished.push('undo'),
    onNote: () => finished.push('note'),
    onDone: () => finished.push('done'),
  };
  return { actions, picked, cancelled, finished };
}
