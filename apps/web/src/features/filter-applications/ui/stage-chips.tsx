'use client';

import { ACTIVE_STAGES, type ApplicationListItem, STAGE_LABELS } from '@jobflow/shared';

import { STAGE_COLOR_CLASS } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { ToggleChip } from '@/shared/ui/toggle-chip';

import { useApplicationFilters } from '../model/filters-store';

export type StageChipsProps = Readonly<{
  applications: readonly ApplicationListItem[] | undefined;
}>;

const UNKNOWN_COUNT = (
  <span aria-hidden className="invisible tabular-nums">
    0
  </span>
);

export function StageChips({ applications }: StageChipsProps) {
  const picked = useApplicationFilters((store) => store.filters.stage);
  const { toggleStage } = useApplicationFilters((store) => store.actions);
  return (
    <div role="group" aria-label={uk.board.filters.stage} className="flex flex-wrap gap-1.25">
      {ACTIVE_STAGES.map((stage) => {
        const on = picked?.includes(stage) ?? false;
        return (
          <ToggleChip
            key={stage}
            pressed={on}
            onClick={() => {
              toggleStage(stage);
            }}
          >
            <span
              aria-hidden
              className={cn('size-1.75 flex-none rounded-[3px]', STAGE_COLOR_CLASS[stage])}
            />
            {STAGE_LABELS[stage].labelUk}
            {applications === undefined ? (
              UNKNOWN_COUNT
            ) : (
              <span className={cn('animate-fade-in tabular-nums', !on && 'text-ink-3')}>
                {applications.filter((application) => application.currentStage === stage).length}
              </span>
            )}
          </ToggleChip>
        );
      })}
    </div>
  );
}
