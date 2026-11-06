import { type ApplicationFilters, type Stage, STAGES } from '@jobflow/shared';

export function shownStagesOf({ stage }: ApplicationFilters): Stage[] {
  return STAGES.filter((shown) => stage?.includes(shown) ?? true);
}
