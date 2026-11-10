'use client';

import {
  type ApplicationBoardResponse,
  type ApplicationFilters,
  OPEN_STAGES,
  type OpenStage,
  OUTCOME_STAGES,
  type OutcomeStage,
  type Stage,
} from '@jobflow/shared';
import { LayoutGroup, motion } from 'motion/react';
import type { ReactNode } from 'react';

import { type ApplicationCardContext, FirstRunState } from '@/entities/application';
import {
  ApplicationFiltersProvider,
  useApplicationFilters,
  ViewSwitch,
} from '@/features/filter-applications';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { LoadingRegion } from '@/shared/ui/loading-region';
import { ColumnSkeleton } from '@/shared/ui/skeleton';

import type { BoardDensityState } from '../model/board-density-cookie';
import { BoardDensityProvider } from '../model/board-density-store';
import { shownStagesOf } from '../model/shown-stages';
import { type BoardLoad, useKanbanBoard } from '../model/use-kanban-board';
import { BoardColumn } from './board-column';
import { BoardDnd } from './board-dnd';
import { BoardEmptySearch } from './board-empty-search';
import { BoardToolbar } from './board-toolbar';
import { ColumnCards } from './column-cards';
import { BOARD_FRAME, STRIP_LOOK } from './column-frame';
import { OutcomeLane } from './outcome-lane';
import { ParsingStatus } from './parsing-status';

const FOOTNOTES: Partial<Record<OpenStage, readonly string[]>> = { final: uk.board.finalNote };

const SHORT_COLUMN = { noteUpTo: 2 } as const;

type BoardColumnsProps = Readonly<{
  board: ApplicationBoardResponse;
  context: ApplicationCardContext;
  outcomes: {
    expanded: readonly OutcomeStage[];
    onToggle: (stage: OutcomeStage) => void;
    load: BoardLoad;
  };
  stages: readonly Stage[];
}>;

type BoardFrameProps = Readonly<{ children: ReactNode; busy?: boolean }>;

function BoardFrame({ children, busy }: BoardFrameProps) {
  return (
    <motion.div
      layoutScroll
      aria-busy={busy}
      className={cn(BOARD_FRAME.width, 'overflow-x-auto p-1')}
    >
      <div className="flex items-stretch gap-3">{children}</div>
    </motion.div>
  );
}

function BoardSkeleton() {
  return (
    <LoadingRegion>
      <p aria-hidden className={cn(BOARD_FRAME.width, BOARD_FRAME.toolbar, 'eyebrow')}>
        <span className="inline-block h-2.25 w-28 rounded-[7px] bg-line-soft align-middle" />
      </p>
      <BoardFrame>
        {OPEN_STAGES.map((stage) => (
          <div key={stage} aria-hidden className="min-w-62.5 flex-1">
            <ColumnSkeleton />
          </div>
        ))}
        {OUTCOME_STAGES.map((stage) => (
          <div
            key={stage}
            aria-hidden
            className={cn('w-14.5 flex-none rounded-2xl', STRIP_LOOK[stage].lane)}
          />
        ))}
      </BoardFrame>
    </LoadingRegion>
  );
}

function FirstRunBoard() {
  return (
    <div className="animate-fade-in">
      <div className={cn(BOARD_FRAME.width, BOARD_FRAME.toolbar, 'justify-end')}>
        <ViewSwitch current="board" />
      </div>
      <BoardFrame>
        <BoardColumn column={{ stage: 'applied', count: 0 }}>
          <FirstRunState />
        </BoardColumn>
      </BoardFrame>
    </div>
  );
}

function BoardColumns({ board, context, outcomes, stages }: BoardColumnsProps) {
  const { columns } = board;
  const shown = (stage: Stage) => stages.includes(stage);
  return (
    <BoardFrame busy={outcomes.load.filtersPending}>
      <ParsingStatus count={context.parsingIds?.length ?? 0} />
      <BoardDnd board={board} context={context}>
        {OPEN_STAGES.filter(shown).map((stage) => (
          <BoardColumn key={stage} column={{ stage, count: columns[stage].count }}>
            <ColumnCards
              stage={stage}
              items={columns[stage].items ?? []}
              context={context}
              footnote={
                columns[stage].count <= SHORT_COLUMN.noteUpTo ? FOOTNOTES[stage] : undefined
              }
            />
          </BoardColumn>
        ))}
        {OUTCOME_STAGES.filter(shown).map((stage) => (
          <OutcomeLane
            key={stage}
            column={{ stage, ...columns[stage] }}
            context={context}
            load={outcomes.load}
            disclosure={{
              expanded: outcomes.expanded.includes(stage),
              onToggle: () => {
                outcomes.onToggle(stage);
              },
            }}
          />
        ))}
      </BoardDnd>
    </BoardFrame>
  );
}

function BoardContent() {
  const { data, context, outcomes, search } = useKanbanBoard();
  const filters = useApplicationFilters((store) => store.filters);
  if (data === undefined) {
    if (!outcomes.load.failed) {
      return <BoardSkeleton />;
    }
    return (
      <div className="max-w-120 animate-fade-in">
        <LoadFailedPanel onRetry={outcomes.load.onRetry} />
      </div>
    );
  }
  const stages = shownStagesOf(filters);
  const empty = stages.every((stage) => data.columns[stage].count === 0);
  if (empty && !search.filtered) {
    return <FirstRunBoard />;
  }
  return (
    <div className="animate-fade-in">
      <LayoutGroup>
        <BoardToolbar board={data} load={outcomes.load} view={{ cards: !empty }} />
        {empty ? (
          <BoardEmptySearch q={search.q} />
        ) : (
          <BoardColumns board={data} context={context} outcomes={outcomes} stages={stages} />
        )}
      </LayoutGroup>
    </div>
  );
}

export type KanbanBoardProps = Readonly<{
  initial: BoardDensityState & { filters?: ApplicationFilters };
}>;

export function KanbanBoard({ initial }: KanbanBoardProps) {
  return (
    <BoardDensityProvider initial={{ density: initial.density }}>
      <ApplicationFiltersProvider initial={initial.filters ?? {}}>
        <BoardContent />
      </ApplicationFiltersProvider>
    </BoardDensityProvider>
  );
}
