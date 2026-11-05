import { use } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { useBoardDensity } from '../model/board-density-store';
import { DragSourceContext, isLanding } from '../model/drag-source';
import { useColumnVirtualizer } from '../model/use-column-virtualizer';
import type { ColumnCardsProps } from './column-cards';
import { COLUMN_FRAME } from './column-frame';
import { ColumnNote } from './column-note';
import { DraggableCard } from './draggable-card';

export type VirtualColumnCardsProps = Omit<ColumnCardsProps, 'stage'>;

const ROW = 'absolute inset-x-0 top-0';

export function VirtualColumnCards({ items, context, footnote }: VirtualColumnCardsProps) {
  const source = use(DragSourceContext);
  const density = useBoardDensity((store) => store.density);
  const { rows, totalSize, below, measureElement, scrollRef } = useColumnVirtualizer({
    items,
    density,
    source,
  });
  return (
    <>
      <div ref={scrollRef} data-column-scroll className={COLUMN_FRAME.scroller}>
        <div className="relative" style={{ height: totalSize }}>
          {rows.flatMap((row) => {
            const application = items[row.index];
            if (application === undefined) return [];
            return (
              <div
                key={row.key}
                ref={measureElement}
                data-index={row.index}
                className={cn(ROW, isLanding(application, source.landing) && 'invisible')}
                style={{ transform: `translateY(${String(row.start)}px)` }}
              >
                <DraggableCard application={application} context={context} view={{ density }} />
              </div>
            );
          })}
        </div>
      </div>
      {footnote !== undefined && <ColumnNote lines={footnote} />}
      {below > 0 && <p className={COLUMN_FRAME.hint}>{uk.board.moreBelow(below)}</p>}
    </>
  );
}
