import { ACTIVE_STAGES, type ApplicationBoardResponse } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { SegmentedControl } from '@/shared/ui/segmented-control';

import { useBoardDensity } from '../model/board-density-store';
import { BOARD_DENSITY_OPTIONS } from '../model/density-options';
import { BOARD_FRAME } from './column-frame';

export type BoardToolbarProps = Readonly<{ board: ApplicationBoardResponse }>;

export function BoardToolbar({ board }: BoardToolbarProps) {
  const density = useBoardDensity((store) => store.density);
  const setDensity = useBoardDensity((store) => store.setDensity);
  const inWork = ACTIVE_STAGES.reduce((sum, stage) => sum + board.columns[stage].count, 0);
  return (
    <div className={cn(BOARD_FRAME.width, BOARD_FRAME.toolbar)}>
      <p className="eyebrow text-ink-3 tabular-nums">{uk.board.eyebrow(inWork)}</p>
      <SegmentedControl
        aria-label={uk.board.density.label}
        options={BOARD_DENSITY_OPTIONS}
        value={density}
        onValueChange={setDensity}
      />
    </div>
  );
}
