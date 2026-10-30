import { type ActiveStage, STAGE_LABELS } from '@jobflow/shared';

import { StageMarker } from './stage-marker';

export type StageChipProps = Readonly<{ stage: ActiveStage }>;

export function StageChip({ stage }: StageChipProps) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-pill bg-surface px-3.75 py-2 text-[14px] leading-[normal] font-medium text-ink shadow-e1 inset-ring inset-ring-line-soft">
      <StageMarker stage={stage} />
      {STAGE_LABELS[stage].labelUk}
    </span>
  );
}
