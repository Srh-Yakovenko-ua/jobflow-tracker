import type { DragEndEvent, DragStartEvent, Over, UniqueIdentifier } from '@dnd-kit/core';
import type { ApplicationBoardResponse, ApplicationCard } from '@jobflow/shared';
import { useState } from 'react';

import type { ApplicationMove } from '@/entities/application';
import {
  isLegalDrop,
  useMoveApplicationMutation,
  useUndoMoveMutation,
} from '@/features/move-application';
import { useRejectionPrompt } from '@/features/reject-with-reason';

import { findCard, stageOf } from './board-lookup';

type DropAttempt = { card: ApplicationCard | undefined; over: Over | null };

function legalMoveOf({ card, over }: DropAttempt): ApplicationMove | undefined {
  const toStage = stageOf(over);
  if (card === undefined || toStage === undefined) {
    return undefined;
  }
  return isLegalDrop({ from: card.currentStage, to: toStage })
    ? { application: card, toStage }
    : undefined;
}

export function useBoardDrag(board: ApplicationBoardResponse) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const { mutate } = useMoveApplicationMutation();
  const { mutate: undo } = useUndoMoveMutation();
  const rejection = useRejectionPrompt({ send: mutate, undo });
  const activeCard = activeId === null ? undefined : findCard(board, activeId);
  const onDragEnd = ({ over }: DragEndEvent) => {
    setActiveId(null);
    const move = legalMoveOf({ card: activeCard, over });
    if (move === undefined) return;
    if (move.toStage === 'rejected') {
      rejection.ask(move);
      return;
    }
    mutate(move);
  };
  const handlers = {
    onDragStart: ({ active }: DragStartEvent) => {
      setActiveId(active.id);
    },
    onDragEnd,
    onDragCancel: () => {
      setActiveId(null);
    },
  };
  return { activeCard, handlers, rejection };
}
