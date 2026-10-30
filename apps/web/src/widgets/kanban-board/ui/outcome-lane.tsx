import { type ApplicationBoardResponse, type OutcomeStage, STAGE_LABELS } from '@jobflow/shared';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { type ApplicationCardContext, StageMarker } from '@/entities/application';
import { cn } from '@/shared/lib/cn';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { CardSkeleton } from '@/shared/ui/skeleton';

import { useDropZone } from '../model/drag-source';
import type { BoardLoad } from '../model/use-kanban-board';
import { ColumnCards } from './column-cards';
import { COLUMN_FRAME } from './column-frame';
import { type ColumnHead, ColumnTitle } from './column-title';
import { DropPlaceholder } from './drop-placeholder';

export type OutcomeColumn = ApplicationBoardResponse['columns'][OutcomeStage] & {
  stage: OutcomeStage;
};

export type OutcomeLaneProps = Readonly<{
  column: OutcomeColumn;
  context: ApplicationCardContext;
  disclosure: { expanded: boolean; onToggle: () => void };
  load: BoardLoad;
}>;

type StripLook = { lane: string; label: string; chevron: string };

const RAISED_STRIP: StripLook = {
  lane: 'bg-surface-3',
  label: 'text-ink-2',
  chevron: 'text-ink-2 shadow-e1',
};

const STRIP_LOOK: Record<OutcomeStage, StripLook> = {
  rejected: RAISED_STRIP,
  ghosted: {
    lane: 'bg-paper inset-ring inset-ring-line-soft',
    label: 'text-ink-3',
    chevron: 'text-ink-3 inset-ring inset-ring-line-soft',
  },
  withdrawn: RAISED_STRIP,
};

const STRIP = {
  lane: 'flex w-14.5 flex-none rounded-2xl data-[drop=over]:focus-halo',
  button: 'group flex w-full flex-col items-center gap-3.5 rounded-2xl py-3',
  chevron:
    'flex size-7.5 items-center justify-center rounded-md bg-surface transition-colors duration-(--duration-instant) group-hover:text-link group-active:bg-surface-2',
  label:
    'flex rotate-180 items-center gap-2.5 text-[13px] leading-[normal] font-semibold [writing-mode:vertical-rl]',
  count: 'text-[12px] font-normal text-ink-3 tabular-nums',
} as const;

function StripFace({ stage, count }: Readonly<ColumnHead<OutcomeStage>>) {
  const look = STRIP_LOOK[stage];
  return (
    <>
      <span className={cn(STRIP.chevron, look.chevron)}>
        <ChevronRight aria-hidden />
      </span>
      <span className={cn(STRIP.label, look.label)}>
        {STAGE_LABELS[stage].labelUk} <span className={STRIP.count}>{count}</span>
      </span>
      <span className="mt-auto flex">
        <StageMarker stage={stage} />
      </span>
    </>
  );
}

function LaneBody({ column, context, load }: Omit<OutcomeLaneProps, 'disclosure'>) {
  if (column.items !== null) {
    return <ColumnCards items={column.items} context={context} />;
  }
  if (load.failed) {
    return <LoadFailedPanel onRetry={load.onRetry} />;
  }
  return <CardSkeleton />;
}

export function OutcomeLane({ column, context, disclosure, load }: OutcomeLaneProps) {
  const { expanded, onToggle } = disclosure;
  const look = STRIP_LOOK[column.stage];
  const { setNodeRef, drop } = useDropZone(column.stage);
  return (
    <section
      ref={setNodeRef}
      data-drop={drop}
      aria-busy={expanded && column.items === null && !load.failed}
      className={cn(expanded ? COLUMN_FRAME.column : [STRIP.lane, look.lane], COLUMN_FRAME.drop)}
    >
      <h2 className={cn(!expanded && 'flex w-full')}>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className={
            expanded ? cn(COLUMN_FRAME.header, 'touch-target w-full rounded-md') : STRIP.button
          }
        >
          {expanded ? (
            <>
              <ColumnTitle column={column} />
              <ChevronDown aria-hidden className="flex-none text-ink-3" />
            </>
          ) : (
            <StripFace stage={column.stage} count={column.count} />
          )}
        </button>
      </h2>
      {expanded && drop === 'over' && <DropPlaceholder />}
      {expanded && <LaneBody column={column} context={context} load={load} />}
    </section>
  );
}
