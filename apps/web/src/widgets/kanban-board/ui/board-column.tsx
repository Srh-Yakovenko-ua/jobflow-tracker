import type { OpenStage } from '@jobflow/shared';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import { useDropZone } from '../model/drag-source';
import { COLUMN_FRAME } from './column-frame';
import { type ColumnHead, ColumnTitle } from './column-title';
import { DropPlaceholder } from './drop-placeholder';

export type BoardColumnProps = Readonly<{
  column: ColumnHead<OpenStage>;
  children: ReactNode;
}>;

export function BoardColumn({ column, children }: BoardColumnProps) {
  const { setNodeRef, drop } = useDropZone(column.stage);
  return (
    <section
      ref={setNodeRef}
      data-drop={drop}
      className={cn(
        COLUMN_FRAME.column,
        COLUMN_FRAME.drop,
        column.stage === 'offer' && COLUMN_FRAME.offer,
      )}
    >
      <h2 className={COLUMN_FRAME.header}>
        <ColumnTitle column={column} />
      </h2>
      {drop === 'over' && <DropPlaceholder />}
      {children}
    </section>
  );
}
