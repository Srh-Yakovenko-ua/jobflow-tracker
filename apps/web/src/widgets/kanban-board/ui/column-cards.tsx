import { useDndContext } from '@dnd-kit/core';
import type { ApplicationCard as ApplicationCardData, Stage } from '@jobflow/shared';
import { AnimatePresence, motion } from 'motion/react';
import { type Ref, use } from 'react';

import type { ApplicationCardContext } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { Fade, FADE_PRESENCE, type FadeMotion, type FadeProps } from '@/shared/ui/fade';

import { DragSourceContext, type LandingCard } from '../model/drag-source';
import { DraggableCard } from './draggable-card';

export type ColumnCardsProps = Readonly<{
  stage: Stage;
  items: readonly ApplicationCardData[];
  context: ApplicationCardContext;
  footnote?: readonly string[] | undefined;
}>;

type ColumnNoteProps = Readonly<{
  lines: readonly string[];
  ref?: Ref<HTMLParagraphElement>;
}>;

const LANDING = { className: 'invisible', transition: { duration: 0 } } as const;

function ColumnNote({ lines, ref }: ColumnNoteProps) {
  return (
    <motion.p
      ref={ref}
      layout
      {...FADE_PRESENCE}
      className="flex min-h-16.5 flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-line p-3 text-center text-[12px] leading-[1.5] text-ink-3"
    >
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </motion.p>
  );
}

function isLanding(application: ApplicationCardData, landing: LandingCard | null): boolean {
  return application.id === landing?.id && application.currentStage === landing.stage;
}

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

export function ColumnCards({ stage, items, context, footnote }: ColumnCardsProps) {
  const { landing } = use(DragSourceContext);
  const dropOver = useDndContext().over?.id === stage;
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {items.map((application) => (
        <Fade key={application.id} {...cardFade(application, landing)}>
          <DraggableCard application={application} context={context} />
        </Fade>
      ))}
      {footnote !== undefined && <ColumnNote key="footnote" lines={footnote} />}
      {footnote === undefined && items.length === 0 && !dropOver && (
        <ColumnNote key="empty" lines={uk.board.columnEmpty} />
      )}
    </AnimatePresence>
  );
}
