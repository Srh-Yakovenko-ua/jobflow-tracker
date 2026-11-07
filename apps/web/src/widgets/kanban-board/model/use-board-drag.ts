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
import { isLanding, type LandingCard } from './drag-source';
import { createDropGlide, DROP_GLIDE, type DropLanding } from './drop-glide';

type DropAttempt = { card: ApplicationCard | undefined; over: Over | null };

type Landing = LandingCard & Readonly<{ glide: DropLanding }>;

export type FocusRequest = LandingCard;

type FollowedCard = Readonly<{ follow: UniqueIdentifier }>;

function legalMoveOf({ card, over }: DropAttempt): ApplicationMove | undefined {
  const toStage = stageOf(over);
  if (card === undefined || toStage === undefined) {
    return undefined;
  }
  return isLegalDrop({ from: card.currentStage, to: toStage })
    ? { application: card, toStage }
    : undefined;
}

function placeOf(card: ApplicationCard | undefined): FocusRequest | null {
  return card === undefined ? null : { id: card.id, stage: card.currentStage };
}

function sourceLandingOf(card: ApplicationCard | undefined): Landing | null {
  const place = placeOf(card);
  return place === null ? null : { ...place, glide: 'to-source' };
}

function sentLandingOf({ application, toStage }: ApplicationMove): Landing {
  const glide = canDragFrom(toStage) ? 'to-card' : 'in-place';
  return { id: application.id, stage: toStage, glide };
}

function focusTargetOf({ application, toStage }: ApplicationMove): FocusRequest {
  return { id: canDragFrom(toStage) ? application.id : toStage, stage: toStage };
}

function placedFocus(
  board: ApplicationBoardResponse,
  request: FocusRequest | FollowedCard | null,
): FocusRequest | null {
  if (request === null) return null;
  if ('follow' in request) return placeOf(findCard(board, request.follow));
  if (request.id === request.stage) return request;
  const card = findCard(board, request.id);
  return card !== undefined && isLanding(card, request) ? request : null;
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

function keyboardOnly(event: DragCancelEvent, target: FocusRequest | null): FocusRequest | null {
  return event.activatorEvent instanceof KeyboardEvent ? target : null;
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
  const [focusRequest, setFocusRequest] = useState<FocusRequest | FollowedCard | null>(null);
  const { landing, setLanding, dropAnimation } = useDropLanding();
  const { rejection, sent } = useMoveSender(({ application }) => {
    setFocusRequest({ follow: application.id });
  });
  const activeCard = activeId === null ? undefined : findCard(board, activeId);
  const putBack = (event: DragCancelEvent) => {
    const source = sourceLandingOf(activeCard);
    setActiveId(null);
    setLanding(source);
    setFocusRequest(keyboardOnly(event, source));
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
    setFocusRequest(landed ? keyboardOnly(event, focusTargetOf(move)) : null);
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
  const keyboardFocus = landing === null ? placedFocus(board, focusRequest) : null;
  return { activeCard, landing: landingToHide, dropAnimation, handlers, rejection, keyboardFocus };
}
