import { type Stage, STAGE_LABELS } from '@jobflow/shared';

import { cn } from '@/shared/lib/cn';

import { StageMarker } from './stage-marker';

export type StageChipSize = 'md' | 'sm';

export type StageChipProps = Readonly<{ stage: Stage; view?: { size?: StageChipSize } }>;

const SIZES: Record<StageChipSize, string> = {
  md: 'gap-2 rounded-pill bg-surface px-3.75 py-2 text-[14px] leading-[normal] shadow-e1 inset-ring-line-soft',
  sm: 'gap-1.75 rounded-md bg-surface-2 px-2.5 py-1 text-[13px] leading-[1.35] inset-ring-line',
};

export function StageChip({ stage, view }: StageChipProps) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center font-medium text-ink inset-ring',
        SIZES[view?.size ?? 'md'],
      )}
    >
      <StageMarker stage={stage} />
      {STAGE_LABELS[stage].labelUk}
    </span>
  );
}
