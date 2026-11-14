'use client';

import { ACTIVE_STAGES, type ApplicationListItem, STAGE_LABELS } from '@jobflow/shared';

import { STAGE_COLOR_CLASS } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { useApplicationFilters } from '../model/filters-store';

const CHIP = {
  base: cn(
    'touch-target flex h-7.5 flex-none items-center gap-1.75 rounded-full px-2.75 text-[12px] font-medium transition-colors duration-(--duration-instant) ease-standard',
    TOUCH_HEIGHT,
  ),
  idle: 'bg-surface-2 text-ink-2 inset-ring inset-ring-line hover:bg-surface-3 active:bg-surface-3',
  picked:
    'bg-accent text-surface shadow-accent hover:bg-accent-press active:bg-accent-press dark:hover:text-paper dark:active:text-paper',
} as const;

export type StageChipsProps = Readonly<{ applications: readonly ApplicationListItem[] }>;

export function StageChips({ applications }: StageChipsProps) {
  const picked = useApplicationFilters((store) => store.filters.stage);
  const { toggleStage } = useApplicationFilters((store) => store.actions);
  return (
    <div role="group" aria-label={uk.board.filters.stage} className="flex flex-wrap gap-1.25">
      {ACTIVE_STAGES.map((stage) => {
        const on = picked?.includes(stage) ?? false;
        return (
          <button
            key={stage}
            type="button"
            aria-pressed={on}
            className={cn(CHIP.base, on ? CHIP.picked : CHIP.idle)}
            onClick={() => {
              toggleStage(stage);
            }}
          >
            <span
              aria-hidden
              className={cn('size-1.75 flex-none rounded-[3px]', STAGE_COLOR_CLASS[stage])}
            />
            {STAGE_LABELS[stage].labelUk}
            <span className={cn('tabular-nums', !on && 'text-ink-3')}>
              {applications.filter((application) => application.currentStage === stage).length}
            </span>
          </button>
        );
      })}
    </div>
  );
}
