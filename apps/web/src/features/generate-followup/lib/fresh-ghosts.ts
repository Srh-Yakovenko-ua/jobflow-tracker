import type { BoardCard } from '@jobflow/shared';

export const GHOST_FOLLOWUP = { freshDaysMax: 45 } as const;

export function freshGhostsOf(items: readonly BoardCard[]): BoardCard[] {
  return items.filter(
    (card) =>
      card.currentStage === 'ghosted' &&
      !card.isDraft &&
      card.daysSinceLastEvent < GHOST_FOLLOWUP.freshDaysMax,
  );
}
