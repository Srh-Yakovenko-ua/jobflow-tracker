import type { ApplicationBoardResponse } from '@jobflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { applicationKeys } from '@/entities/application';
import { errorReply } from '@/test/api-handlers';
import { boardOf, cardIn, undoRoute } from '@/test/board-fixtures';
import { latch } from '@/test/latch';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { useUndoMoveMutation } from './use-undo-move-mutation';

const REJECTED_CARD = cardIn({
  serial: 1,
  stage: 'rejected',
  position: 'Senior Frontend Engineer',
});

const STAYING = cardIn({ serial: 2, stage: 'applied', position: 'Product Designer' });

const MOVE = {
  application: { ...REJECTED_CARD, currentStage: 'applied' },
  toStage: 'rejected',
} as const;

const BOARD_KEY = applicationKeys.board({});

const REJECTED_BOARD = boardOf(
  { applied: 1, rejected: 33 },
  { cards: [STAYING, REJECTED_CARD], stages: ['applied'] },
);

function renderUndo() {
  const { result } = renderHookInApp(() => ({
    undo: useUndoMoveMutation(),
    queryClient: useQueryClient(),
  }));
  act(() => {
    result.current.queryClient.setQueryData(BOARD_KEY, REJECTED_BOARD);
  });
  return result;
}

function boardIn(result: ReturnType<typeof renderUndo>) {
  return result.current.queryClient.getQueryData<ApplicationBoardResponse>(BOARD_KEY);
}

afterEach(() => {
  toast.dismiss();
});

describe('useUndoMoveMutation', () => {
  it('puts the card back on its from-stage at once and sends one undo-last with no body', async () => {
    const undone = undoRoute({ latch: latch() });
    server.use(undone.handler);
    const result = renderUndo();

    act(() => {
      result.current.undo.mutate(MOVE);
    });

    await waitFor(() => {
      expect(boardIn(result)?.columns.rejected.count).toBe(32);
    });
    expect(boardIn(result)?.columns.applied.count).toBe(2);
    expect(boardIn(result)?.columns.applied.items?.map((card) => card.position)).toEqual([
      'Senior Frontend Engineer',
      'Product Designer',
    ]);
    await waitFor(() => {
      expect(undone.sent).toEqual([{ id: REJECTED_CARD.id, body: '' }]);
    });
  });

  it('a 409 conflict puts the board back as rejected and says the undo window has passed', async () => {
    server.use(undoRoute({ reply: () => errorReply({ status: 409, type: 'conflict' }) }).handler);
    const result = renderUndo();

    act(() => {
      result.current.undo.mutate(MOVE);
    });

    expect(await screen.findByText('Час на скасування минув')).toBeDefined();
    expect(boardIn(result)).toEqual(REJECTED_BOARD);
    expect(toast.getToasts()).toHaveLength(1);
  });
});
