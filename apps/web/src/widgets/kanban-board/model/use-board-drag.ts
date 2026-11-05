import type { DragEndEvent, DragStartEvent, Over, UniqueIdentifier } from '@dnd-kit/core';
import type { ApplicationBoardResponse, ApplicationCard } from '@jobflow/shared';
import { useState } from 'react';

import type { ApplicationMove } from '@/entities/application';
import {
  canDragFrom,
  isLegalDrop,
  useMoveApplicationMutation,
  useUndoMoveMutation,
} from '@/features/move-application';
import { useRejectionPrompt } from '@/features/reject-with-reason';

import { findCard, stageOf } from './board-lookup';
import type { LandingCard } from './drag-source';
import { createDropGlide, type DropLanding } from './drop-glide';

type DropAttempt = { card: ApplicationCard | undefined; over: Over | null };

type Landing = LandingCard & Readonly<{ glide: DropLanding }>;

function legalMoveOf({ card, over }: DropAttempt): ApplicationMove | undefined {
  const toStage = stageOf(over);
  if (card === undefined || toStage === undefined) {
    return undefined;
  }
  return isLegalDrop({ from: card.currentStage, to: toStage })
    ? { application: card, toStage }
    : undefined;
}

function sourceLandingOf(card: ApplicationCard | undefined): Landing | null {
  return card === undefined ? null : { id: card.id, stage: card.currentStage, glide: 'to-source' };
}

function sentLandingOf({ application, toStage }: ApplicationMove): Landing {
  const glide = canDragFrom(toStage) ? 'to-card' : 'in-place';
  return { id: application.id, stage: toStage, glide };
}

function useDropLanding() {
  const [landing, setLanding] = useState<Landing | null>(null);
  const dropAnimation = createDropGlide({
    landing: landing?.glide ?? 'to-source',
    onLanded: () => {
      setLanding((current) => (current === landing ? null : current));
    },
  });
  return { landing, setLanding, dropAnimation };
}

export function useBoardDrag(board: ApplicationBoardResponse) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const { landing, setLanding, dropAnimation } = useDropLanding();
  const { mutate } = useMoveApplicationMutation();
  const { mutate: undo } = useUndoMoveMutation();
  const rejection = useRejectionPrompt({ send: mutate, undo });
  const activeCard = activeId === null ? undefined : findCard(board, activeId);
  const sent = (move: ApplicationMove): boolean => {
    if (move.toStage === 'rejected') return rejection.ask(move) === 'sent';
    mutate(move);
    return true;
  };
  const onDragEnd = ({ over }: DragEndEvent) => {
    setActiveId(null);
    const move = legalMoveOf({ card: activeCard, over });
    const landed = move !== undefined && sent(move);
    setLanding(landed ? sentLandingOf(move) : sourceLandingOf(activeCard));
  };
  const handlers = {
    onDragStart: ({ active }: DragStartEvent) => {
      setActiveId(active.id);
      setLanding(null);
    },
    onDragEnd,
    onDragCancel: () => {
      setActiveId(null);
      setLanding(sourceLandingOf(activeCard));
    },
  };
  return { activeCard, landing, dropAnimation, handlers, rejection };
}
