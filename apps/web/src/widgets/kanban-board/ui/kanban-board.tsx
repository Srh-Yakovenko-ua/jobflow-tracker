'use client';

import {
  type ApplicationBoardResponse,
  OPEN_STAGES,
  type OpenStage,
  OUTCOME_STAGES,
  type OutcomeStage,
  STAGES,
} from '@jobflow/shared';
import { LayoutGroup, motion } from 'motion/react';
import type { ReactNode } from 'react';

import type { ApplicationCardContext } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { ColumnSkeleton } from '@/shared/ui/skeleton';

import type { BoardDensityState } from '../model/board-density-cookie';
import { BoardDensityProvider } from '../model/board-density-store';
import { type BoardLoad, useKanbanBoard } from '../model/use-kanban-board';
import { BoardColumn } from './board-column';
import { BoardDnd } from './board-dnd';
import { BoardToolbar } from './board-toolbar';
import { ColumnCards } from './column-cards';
import { BOARD_FRAME, STRIP_LOOK } from './column-frame';
import { FirstRunState } from './first-run-state';
import { OutcomeLane } from './outcome-lane';

const FOOTNOTES: Partial<Record<OpenStage, readonly string[]>> = { final: uk.board.finalNote };

type BoardColumnsProps = Readonly<{
  board: ApplicationBoardResponse;
  context: ApplicationCardContext;
  outcomes: {
    expanded: readonly OutcomeStage[];
    onToggle: (stage: OutcomeStage) => void;
    load: BoardLoad;
  };
}>;

function BoardFrame({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <motion.div layoutScroll className={cn(BOARD_FRAME.width, 'overflow-x-auto p-1')}>
      <div className="flex items-stretch gap-3">{children}</div>
    </motion.div>
  );
}

function BoardSkeleton() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        {uk.ui.loading}
      </p>
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
    </div>
  );
}

function FirstRunBoard() {
  return (
    <div className="animate-fade-in">
      <BoardFrame>
        <BoardColumn column={{ stage: 'applied', count: 0 }}>
          <FirstRunState />
        </BoardColumn>
      </BoardFrame>
    </div>
  );
}

function BoardColumns({ board, context, outcomes }: BoardColumnsProps) {
  const { columns } = board;
  return (
    <LayoutGroup>
      <BoardToolbar board={board} />
      <BoardFrame>
        <BoardDnd board={board} context={context}>
          {OPEN_STAGES.map((stage) => (
            <BoardColumn key={stage} column={{ stage, count: columns[stage].count }}>
              <ColumnCards
                stage={stage}
                items={columns[stage].items ?? []}
                context={context}
                footnote={FOOTNOTES[stage]}
              />
            </BoardColumn>
          ))}
          {OUTCOME_STAGES.map((stage) => (
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
    </LayoutGroup>
  );
}

function BoardContent() {
  const { data, context, expanded, onToggle, load } = useKanbanBoard();
  if (data === undefined) {
    if (!load.failed) {
      return <BoardSkeleton />;
    }
    return (
      <div className="max-w-120 animate-fade-in">
        <LoadFailedPanel onRetry={load.onRetry} />
      </div>
    );
  }
  if (STAGES.every((stage) => data.columns[stage].count === 0)) {
    return <FirstRunBoard />;
  }
  return (
    <div className="animate-fade-in">
      <BoardColumns board={data} context={context} outcomes={{ expanded, onToggle, load }} />
    </div>
  );
}

export type KanbanBoardProps = Readonly<{ initial: BoardDensityState }>;

export function KanbanBoard({ initial }: KanbanBoardProps) {
  return (
    <BoardDensityProvider initial={initial}>
      <BoardContent />
    </BoardDensityProvider>
  );
}
