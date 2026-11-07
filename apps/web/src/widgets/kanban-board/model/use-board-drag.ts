import type {
  DragCancelEvent,
  DragEndEvent,
  DragStartEvent,
  Over,
  UniqueIdentifier,
} from '@dnd-kit/core';
import type { ApplicationBoardResponse, ApplicationCard, Stage } from '@jobflow/shared';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  type ApplicationMove,
  applicationQueryOptions,
  type MovingApplication,
} from '@/entities/application';
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

export type BoardFocus = Readonly<{
  request: FocusRequest | null;
  onFocused: (request: FocusRequest | null) => void;
}>;

type ServerStageLookup = Readonly<{ queryClient: QueryClient; application: MovingApplication }>;

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
  request: FocusRequest | null,
): FocusRequest | null {
  if (request === null) return null;
  if (request.id === request.stage) return request;
  const card = findCard(board, request.id);
  return card !== undefined && isLanding(card, request) ? request : null;
}

function settledFrom<T>(done: T) {
  return (current: T | null) => (current === done ? null : current);
}

function serverStageOf({ queryClient, application }: ServerStageLookup): Promise<Stage> {
  return queryClient
    .query({ ...applicationQueryOptions(application.id), staleTime: 0, retry: false })
    .then(({ currentStage }) => currentStage)
    .catch(() => application.currentStage);
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

function useMoveSender(onRefused: (request: FocusRequest) => void) {
  const queryClient = useQueryClient();
  const { mutate } = useMoveApplicationMutation({
    onRollback: ({ application }) => {
      void serverStageOf({ queryClient, application }).then((stage) => {
        onRefused(focusTargetOf({ application, toStage: stage }));
      });
    },
  });
  const { mutate: undo } = useUndoMoveMutation();
  const rejection = useRejectionPrompt({ send: mutate, undo });
  const sent = (move: ApplicationMove) => rejection.sendOrAsk(move) === 'sent';
  return { rejection, sent };
}

export function useBoardDrag(board: ApplicationBoardResponse) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const { landing, setLanding, dropAnimation } = useDropLanding();
  const { rejection, sent } = useMoveSender(setFocusRequest);
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
  const onFocused = (request: FocusRequest | null) => {
    setFocusRequest(settledFrom(request));
  };
  const focus = { request: landing === null ? placedFocus(board, focusRequest) : null, onFocused };
  return { activeCard, landing: landingToHide, dropAnimation, handlers, rejection, focus };
}
