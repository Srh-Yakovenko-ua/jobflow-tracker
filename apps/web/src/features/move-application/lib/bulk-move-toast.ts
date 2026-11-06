import { uk } from '@/shared/i18n';
import type { ToastContent, ToastTone } from '@/shared/ui/toast';

const COPY = uk.board.move.bulk;

export type BulkMoveResult = Readonly<{ moved: number; failed: number; skipped: number }>;

function toneOf({ moved, failed }: BulkMoveResult): ToastTone {
  if (failed > 0) {
    return 'error';
  }
  return moved > 0 ? 'success' : 'info';
}

export function bulkMoveToastOf(result: BulkMoveResult): ToastContent {
  const notes = [
    result.failed > 0 ? COPY.failed(result.failed) : undefined,
    result.skipped > 0 ? COPY.skipped(result.skipped) : undefined,
  ].filter((note) => note !== undefined);
  const title = COPY.moved(result.moved);
  return notes.length === 0
    ? { tone: toneOf(result), title }
    : { tone: toneOf(result), title, description: notes.join(' ') };
}
