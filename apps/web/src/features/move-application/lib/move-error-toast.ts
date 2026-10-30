import { STAGE_LABELS } from '@jobflow/shared';

import { ApiError } from '@/shared/api';
import { uk } from '@/shared/i18n';
import type { ErrorToastContent } from '@/shared/ui/error-toast';

import type { StagePair } from './drop-rules';

export type MoveFailure = Readonly<{ error: Error; move: StagePair }>;

const COPY = uk.board.move;

function conflictTypeOf(error: Error): string | undefined {
  return error instanceof ApiError && error.status === 409 ? error.body.type : undefined;
}

export function moveErrorMessage({ error, move }: MoveFailure): ErrorToastContent {
  const conflict = conflictTypeOf(error);
  if (conflict === 'conflict') {
    return COPY.conflict;
  }
  if (conflict === 'illegal_transition') {
    return COPY.illegal({
      from: STAGE_LABELS[move.from].labelUk,
      to: STAGE_LABELS[move.to].labelUk,
    });
  }
  return COPY.failed;
}
