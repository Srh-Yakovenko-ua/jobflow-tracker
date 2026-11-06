import { ACTIVE_STAGES, type ApplicationBoardResponse } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { Banner } from '@/shared/ui/banner';
import { Button } from '@/shared/ui/button';
import { SegmentedControl } from '@/shared/ui/segmented-control';

import { useBoardDensity } from '../model/board-density-store';
import { BOARD_DENSITY_OPTIONS } from '../model/density-options';
import type { BoardLoad } from '../model/use-kanban-board';
import { BoardFilterMenus } from './board-filter-menus';
import { BoardSearch } from './board-search';
import { BOARD_FRAME } from './column-frame';
import { FilterChipsRow } from './filter-chips';

const LOAD_FAILED = uk.states.errors.loadFailed;

export type BoardToolbarProps = Readonly<{
  board: ApplicationBoardResponse;
  load: BoardLoad;
  view: { cards: boolean };
}>;

function DensitySwitch() {
  const density = useBoardDensity((store) => store.density);
  const setDensity = useBoardDensity((store) => store.setDensity);
  return (
    <SegmentedControl
      aria-label={uk.board.density.label}
      options={BOARD_DENSITY_OPTIONS}
      value={density}
      onValueChange={setDensity}
    />
  );
}

function FilterLoadAlert({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-1 pb-2">
      <Banner tone="error" content={{ title: LOAD_FAILED.title, description: LOAD_FAILED.body }} />
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {LOAD_FAILED.action}
      </Button>
    </div>
  );
}

export function BoardToolbar({ board, load, view }: BoardToolbarProps) {
  const inWork = ACTIVE_STAGES.reduce((sum, stage) => sum + board.columns[stage].count, 0);
  return (
    <div className={BOARD_FRAME.width}>
      <div className={BOARD_FRAME.toolbar}>
        <p className="eyebrow text-ink-3 tabular-nums">{uk.board.eyebrow(inWork)}</p>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <BoardSearch />
          <BoardFilterMenus />
          {view.cards && <DensitySwitch />}
        </div>
      </div>
      {load.filtersFailed && <FilterLoadAlert onRetry={load.onRetry} />}
      {view.cards && <FilterChipsRow />}
    </div>
  );
}
