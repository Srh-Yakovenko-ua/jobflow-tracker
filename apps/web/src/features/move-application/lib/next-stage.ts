import { canTransition, OPEN_STAGES, type OpenStage, type Stage } from '@jobflow/shared';

export function nextStageOf(stage: Stage): OpenStage | null {
  const index = OPEN_STAGES.findIndex((open) => open === stage);
  if (index < 0) return null;
  return OPEN_STAGES.slice(index + 1).find((to) => canTransition(stage, to).ok) ?? null;
}
