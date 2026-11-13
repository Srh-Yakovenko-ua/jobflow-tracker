import type { ApplicationCard, NormsResponse } from '@jobflow/shared';

export type ApplicationCardContext = {
  now: Date;
  timeZone: string;
  stageNorms?: NormsResponse['stageNormDays'];
  parsingIds?: readonly ApplicationCard['id'][];
};
