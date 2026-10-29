import { countedUk, DAY_FORMS_UK } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

const COPY = uk.application;

export type DaysInStageInput = { daysInStage: number; stageNormDays: number };

export function formatDaysInStage({ daysInStage, stageNormDays }: DaysInStageInput): string {
  return `${COPY.daysInStage(countedUk(daysInStage, DAY_FORMS_UK))} ${COPY.stageNorm(stageNormDays)}`;
}
