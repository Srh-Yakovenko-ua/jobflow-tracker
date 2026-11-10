import type { ApplicationCard } from '@jobflow/shared';

export type ApplicationCardContext = {
  now: Date;
  timeZone: string;
  stageNormDays?: number;
  parsingIds?: readonly ApplicationCard['id'][];
};
