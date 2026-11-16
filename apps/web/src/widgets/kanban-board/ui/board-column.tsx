import type { OpenStage } from '@jobflow/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { OFFER_COMPARE } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { buttonLinkClasses } from '@/shared/ui/button';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { useDropZone } from '../model/drag-source';
import { COLUMN_FRAME } from './column-frame';
import { type ColumnHead, ColumnTitle } from './column-title';
import { DropPlaceholder } from './drop-placeholder';

export type BoardColumnProps = Readonly<{
  column: ColumnHead<OpenStage>;
  children: ReactNode;
}>;

function CompareOffersLink({ column }: Readonly<{ column: ColumnHead<OpenStage> }>) {
  if (column.stage !== 'offer' || column.count < OFFER_COMPARE.minOffers) return null;
  return (
    <Link
      href={OFFER_COMPARE.href}
      className={cn(
        buttonLinkClasses({ variant: 'ghost', size: 'xs' }),
        'animate-fade-in self-start',
        TOUCH_HEIGHT,
      )}
    >
      {uk.board.compareOffers}
    </Link>
  );
}

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
      <CompareOffersLink column={column} />
      <DropPlaceholder shown={drop === 'over'} />
      {children}
    </section>
  );
}
