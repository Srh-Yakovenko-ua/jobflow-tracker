import type { DragEndEvent, DragStartEvent, Over, UniqueIdentifier } from '@dnd-kit/core';
import type { ApplicationBoardResponse, ApplicationCard } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { meQueryOptions } from '@/entities/user';
import {
  type ApplicationMove,
  isLegalDrop,
  useMoveApplicationMutation,
} from '@/features/move-application';

import { findCard, stageOf } from './board-lookup';
import { useRejectionPrompt } from './use-rejection-prompt';

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

function useAskRejectionReason(): boolean {
  const { data } = useQuery({
    ...meQueryOptions(),
    select: (me) => me.settings.askRejectionReason,
  });
  return data ?? true;
}

export function useBoardDrag(board: ApplicationBoardResponse) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const askReason = useAskRejectionReason();
  const { mutate } = useMoveApplicationMutation();
  const rejection = useRejectionPrompt(mutate);
  const activeCard = activeId === null ? undefined : findCard(board, activeId);
  const onDragEnd = ({ over }: DragEndEvent) => {
    setActiveId(null);
    const move = legalMoveOf({ card: activeCard, over });
    if (move === undefined) return;
    if (move.toStage === 'rejected' && askReason) {
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
