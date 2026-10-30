'use client';

import {
  ACTIVE_STAGES,
  type ApplicationBoardResponse,
  OPEN_STAGES,
  type OpenStage,
  OUTCOME_STAGES,
  type OutcomeStage,
  STAGES,
} from '@jobflow/shared';
import type { ReactNode } from 'react';

import type { ApplicationCardContext } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { ColumnSkeleton } from '@/shared/ui/skeleton';

import { type BoardLoad, useKanbanBoard } from '../model/use-kanban-board';
import { BoardColumn } from './board-column';
import { ColumnCards } from './column-cards';
import { FirstRunState } from './first-run-state';
import { OutcomeLane } from './outcome-lane';

const FOOTNOTES: Partial<Record<OpenStage, readonly string[]>> = { final: uk.board.finalNote };

const BOARD_WIDTH = 'mx-auto max-w-[1388px]';

type BoardColumnsProps = Readonly<{
  board: ApplicationBoardResponse;
  context: ApplicationCardContext;
  outcomes: {
    expanded: readonly OutcomeStage[];
    onToggle: (stage: OutcomeStage) => void;
    load: BoardLoad;
  };
}>;

function InWorkEyebrow({ board }: Readonly<{ board: ApplicationBoardResponse }>) {
  const inWork = ACTIVE_STAGES.reduce((sum, stage) => sum + board.columns[stage].count, 0);
  return (
    <p className={cn(BOARD_WIDTH, 'eyebrow px-1 pb-2 text-ink-3 tabular-nums')}>
      {uk.board.eyebrow(inWork)}
    </p>
  );
}

function BoardFrame({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className={cn(BOARD_WIDTH, 'overflow-x-auto p-1')}>
      <div className="flex items-stretch gap-3">{children}</div>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        {uk.ui.loading}
      </p>
      <BoardFrame>
        {OPEN_STAGES.map((stage) => (
          <div key={stage} aria-hidden className="min-w-62.5 flex-1">
            <ColumnSkeleton />
          </div>
        ))}
      </BoardFrame>
    </div>
  );
}

function FirstRunBoard() {
  return (
    <BoardFrame>
      <BoardColumn column={{ stage: 'applied', count: 0 }}>
        <FirstRunState />
      </BoardColumn>
    </BoardFrame>
  );
}

function BoardColumns({ board, context, outcomes }: BoardColumnsProps) {
  const { columns } = board;
  return (
    <>
      <InWorkEyebrow board={board} />
      <BoardFrame>
        {OPEN_STAGES.map((stage) => (
          <BoardColumn key={stage} column={{ stage, count: columns[stage].count }}>
            <ColumnCards
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
      </BoardFrame>
    </>
  );
}

export function KanbanBoard() {
  const { data, context, expanded, onToggle, load } = useKanbanBoard();
  if (data === undefined) {
    if (!load.failed) {
      return <BoardSkeleton />;
    }
    return (
      <div className="max-w-120">
        <LoadFailedPanel onRetry={load.onRetry} />
      </div>
    );
  }
  if (STAGES.every((stage) => data.columns[stage].count === 0)) {
    return <FirstRunBoard />;
  }
  return <BoardColumns board={data} context={context} outcomes={{ expanded, onToggle, load }} />;
}
