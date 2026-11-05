import { useDndContext } from '@dnd-kit/core';
import type { ApplicationCard as ApplicationCardData, Stage } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';
import { use } from 'react';

import type { ApplicationCardContext } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { Fade, type FadeMotion, type FadeProps } from '@/shared/ui/fade';

import { useBoardDensity } from '../model/board-density-store';
import { COLUMN_VIRTUAL } from '../model/column-virtual';
import { DragSourceContext, isLanding, type LandingCard } from '../model/drag-source';
import { ColumnNote } from './column-note';
import { DraggableCard } from './draggable-card';
import { VirtualColumnCards } from './virtual-column-cards';

export type ColumnCardsProps = Readonly<{
  stage: Stage;
  items: readonly ApplicationCardData[];
  context: ApplicationCardContext;
  footnote?: readonly string[] | undefined;
}>;

const LANDING = { className: 'invisible', transition: { duration: 0 } } as const;

function cardFade(
  application: ApplicationCardData,
  landing: LandingCard | null,
): Pick<FadeProps, 'className' | 'motion'> {
  const cardMotion: FadeMotion = { layout: true, layoutId: application.id };
  if (!isLanding(application, landing)) return { motion: cardMotion };
  return {
    className: LANDING.className,
    motion: { ...cardMotion, transition: LANDING.transition },
  };
}

function GrowingColumnCards({ stage, items, context, footnote }: ColumnCardsProps) {
  const { landing } = use(DragSourceContext);
  const density = useBoardDensity((store) => store.density);
  const dropOver = useDndContext().over?.id === stage;
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {items.map((application) => (
        <Fade key={application.id} {...cardFade(application, landing)}>
          <DraggableCard application={application} context={context} view={{ density }} />
        </Fade>
      ))}
      {footnote !== undefined && <ColumnNote key="footnote" lines={footnote} />}
      {footnote === undefined && items.length === 0 && !dropOver && (
        <ColumnNote key="empty" lines={uk.board.columnEmpty} />
      )}
    </AnimatePresence>
  );
}

export function ColumnCards({ stage, items, context, footnote }: ColumnCardsProps) {
  if (items.length > COLUMN_VIRTUAL.threshold) {
    return <VirtualColumnCards items={items} context={context} footnote={footnote} />;
  }
  return <GrowingColumnCards stage={stage} items={items} context={context} footnote={footnote} />;
}
