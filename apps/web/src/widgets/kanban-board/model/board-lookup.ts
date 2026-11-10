import type { Over, UniqueIdentifier } from '@dnd-kit/core';
import {
  type ApplicationBoardResponse,
  type ApplicationCard,
  type Stage,
  stageSchema,
} from '@jobflow/shared';

import { draftStateOf } from '@/entities/application';

function cardsOf(board: ApplicationBoardResponse | undefined): ApplicationCard[] {
  return Object.values(board?.columns ?? {}).flatMap((column) => column.items ?? []);
}

export function findCard(
  board: ApplicationBoardResponse,
  id: UniqueIdentifier,
): ApplicationCard | undefined {
  return cardsOf(board).find((card) => card.id === id);
}

export function parsingCardsOf(board: ApplicationBoardResponse | undefined): ApplicationCard[] {
  return cardsOf(board).filter((card) => draftStateOf(card) === 'parsing');
}

export function stageOf(over: Over | null): Stage | undefined {
  const stage = stageSchema.safeParse(over?.id);
  return stage.success ? stage.data : undefined;
}
