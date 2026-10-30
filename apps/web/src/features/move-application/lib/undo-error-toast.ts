import { uk } from '@/shared/i18n';
import type { ErrorToastContent } from '@/shared/ui/error-toast';

import { conflictTypeOf } from './move-error-toast';

export function undoErrorMessage(error: Error): ErrorToastContent {
  return conflictTypeOf(error) === 'conflict' ? uk.board.reject.undoExpired : uk.board.move.failed;
}
