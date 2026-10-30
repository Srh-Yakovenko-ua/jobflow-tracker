import { canTransition, outcomeStageSchema, type Stage } from '@jobflow/shared';

export type StagePair = Readonly<{ from: Stage; to: Stage }>;

export function canDragFrom(stage: Stage): boolean {
  return !outcomeStageSchema.safeParse(stage).success;
}

export function isLegalDrop({ from, to }: StagePair): boolean {
  return from !== to && canTransition(from, to).ok;
}
