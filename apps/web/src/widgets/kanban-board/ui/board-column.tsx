import type { OpenStage } from '@jobflow/shared';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import { COLUMN_FRAME } from './column-frame';
import { type ColumnHead, ColumnTitle } from './column-title';

export type BoardColumnProps = Readonly<{
  column: ColumnHead<OpenStage>;
  children: ReactNode;
}>;

export function BoardColumn({ column, children }: BoardColumnProps) {
  return (
    <section className={cn(COLUMN_FRAME.column, column.stage === 'offer' && COLUMN_FRAME.offer)}>
      <h2 className={COLUMN_FRAME.header}>
        <ColumnTitle column={column} />
      </h2>
      {children}
    </section>
  );
}
