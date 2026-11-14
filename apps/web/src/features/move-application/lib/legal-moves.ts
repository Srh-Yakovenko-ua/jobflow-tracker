import { type Stage, STAGES } from '@jobflow/shared';

import { isLegalDrop } from './drop-rules';

export function legalMovesFrom(stage: Stage): readonly Stage[] {
  return STAGES.filter((to) => isLegalDrop({ from: stage, to }));
}
