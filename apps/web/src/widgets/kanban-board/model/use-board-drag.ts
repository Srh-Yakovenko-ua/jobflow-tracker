import type {
  DragCancelEvent,
  DragEndEvent,
  DragStartEvent,
  Over,
  UniqueIdentifier,
} from '@dnd-kit/core';
import type { ApplicationBoardResponse, ApplicationCard } from '@jobflow/shared';
import { useEffect, useState } from 'react';

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
import { createDropGlide, DROP_GLIDE, type DropLanding } from './drop-glide';

type DropAttempt = { card: ApplicationCard | undefined; over: Over | null };

type Landing = LandingCard & Readonly<{ glide: DropLanding }>;

export type FocusRequest = Readonly<{ id: UniqueIdentifier }>;

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

function focusIdOf({ application, toStage }: ApplicationMove): UniqueIdentifier {
  return canDragFrom(toStage) ? application.id : toStage;
}

function settledFrom(landed: Landing | null) {
  return (current: Landing | null) => (current === landed ? null : current);
}

function useDropLanding() {
  const [landing, setLanding] = useState<Landing | null>(null);
  useEffect(() => {
    if (landing === null) return;
    const settle = setTimeout(() => {
      setLanding(settledFrom(landing));
    }, DROP_GLIDE.settleMs);
    return () => {
      clearTimeout(settle);
    };
  }, [landing]);
  const dropAnimation = createDropGlide({
    landing: landing?.glide ?? 'to-source',
    onLanded: () => {
      setLanding(settledFrom(landing));
    },
  });
  return { landing, setLanding, dropAnimation };
}

function keyboardOnly(event: DragCancelEvent, id: UniqueIdentifier): FocusRequest | null {
  return event.activatorEvent instanceof KeyboardEvent ? { id } : null;
}

function useMoveSender(onRollback: (move: ApplicationMove) => void) {
  const { mutate } = useMoveApplicationMutation({ onRollback });
  const { mutate: undo } = useUndoMoveMutation();
  const rejection = useRejectionPrompt({ send: mutate, undo });
  const sent = (move: ApplicationMove) => rejection.sendOrAsk(move) === 'sent';
  return { rejection, sent };
}

export function useBoardDrag(board: ApplicationBoardResponse) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const { landing, setLanding, dropAnimation } = useDropLanding();
  const { rejection, sent } = useMoveSender(({ application }) => {
    setFocusRequest({ id: application.id });
  });
  const activeCard = activeId === null ? undefined : findCard(board, activeId);
  const putBack = (event: DragCancelEvent) => {
    setActiveId(null);
    setLanding(sourceLandingOf(activeCard));
    setFocusRequest(keyboardOnly(event, event.active.id));
  };
  const onDragEnd = (event: DragEndEvent) => {
    const move = legalMoveOf({ card: activeCard, over: event.over });
    if (move === undefined) {
      putBack(event);
      return;
    }
    setActiveId(null);
    const landed = sent(move);
    setLanding(landed ? sentLandingOf(move) : sourceLandingOf(activeCard));
    setFocusRequest(landed ? keyboardOnly(event, focusIdOf(move)) : null);
  };
  const handlers = {
    onDragStart: ({ active }: DragStartEvent) => {
      setActiveId(active.id);
      setLanding(null);
      setFocusRequest(null);
    },
    onDragEnd,
    onDragCancel: putBack,
  };
  const landingToHide = landing?.glide === 'in-place' ? null : landing;
  const keyboardFocus = landing === null ? focusRequest : null;
  return { activeCard, landing: landingToHide, dropAnimation, handlers, rejection, keyboardFocus };
}
