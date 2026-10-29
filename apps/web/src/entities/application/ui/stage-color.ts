import type { ActiveStage } from '@jobflow/shared';

export const STAGE_COLOR_CLASS: Record<ActiveStage, string> = {
  applied: 'bg-stage-applied',
  screening: 'bg-stage-screening',
  tech_interview: 'bg-stage-tech',
  final: 'bg-stage-final',
};
