import type { RejectionReasonCode } from '@jobflow/shared';

import type { MovingApplication } from '@/entities/application';

export type SavedStep = Readonly<{
  kind: 'saved';
  reasonCode: RejectionReasonCode;
  undoUntil: number;
}>;

export type RejectionStep =
  | Readonly<{ kind: 'choose' }>
  | Readonly<{ kind: 'saving'; reasonCode: RejectionReasonCode }>
  | SavedStep
  | Readonly<{ kind: 'note' }>;

export type RejectionPrompt = Readonly<{ application: MovingApplication; step: RejectionStep }>;

export type RejectionActions = Readonly<{
  onPick: (reasonCode: RejectionReasonCode) => void;
  onCancel: () => void;
  onUndo: () => void;
  onNote: () => void;
  onDone: () => void;
}>;
