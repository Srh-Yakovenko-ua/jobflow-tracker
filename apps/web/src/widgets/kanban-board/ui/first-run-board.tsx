import { FirstRunState } from '@/entities/application';
import { ViewSwitch } from '@/features/filter-applications';
import { cn } from '@/shared/lib/cn';

import { BoardColumn } from './board-column';
import { BoardFrame } from './board-frame';
import { BOARD_FRAME } from './column-frame';

export function FirstRunBoard() {
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
