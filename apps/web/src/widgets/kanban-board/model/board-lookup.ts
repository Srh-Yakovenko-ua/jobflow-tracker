import type { Over, UniqueIdentifier } from '@dnd-kit/core';
import {
  type ApplicationBoardResponse,
  type ApplicationCard,
  type Stage,
  stageSchema,
} from '@jobflow/shared';

export function findCard(
  board: ApplicationBoardResponse,
  id: UniqueIdentifier,
): ApplicationCard | undefined {
  return Object.values(board.columns)
    .flatMap((column) => column.items ?? [])
    .find((card) => card.id === id);
}

export function stageOf(over: Over | null): Stage | undefined {
  const stage = stageSchema.safeParse(over?.id);
  return stage.success ? stage.data : undefined;
}
