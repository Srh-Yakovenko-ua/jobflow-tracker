import type { ApplicationCard as ApplicationCardData } from '@jobflow/shared';
import { AnimatePresence, motion } from 'motion/react';
import { type Ref, use } from 'react';

import type { ApplicationCardContext } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { FADE_PRESENCE } from '@/shared/ui/fade';

import { DragSourceContext, type LandingCard } from '../model/drag-source';
import { DraggableCard } from './draggable-card';

export type ColumnCardsProps = Readonly<{
  items: readonly ApplicationCardData[];
  context: ApplicationCardContext;
  footnote?: readonly string[] | undefined;
}>;

type ColumnNoteProps = Readonly<{
  lines: readonly string[];
  className?: string | undefined;
  ref?: Ref<HTMLParagraphElement>;
}>;

const LANDING = { className: 'invisible', transition: { duration: 0 } } as const;

function ColumnNote({ lines, className, ref }: ColumnNoteProps) {
  return (
    <motion.p
      ref={ref}
      layout
      {...FADE_PRESENCE}
      className={cn(
        'flex min-h-16.5 flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-line p-3 text-center text-[12px] leading-[1.5] text-ink-3',
        className,
      )}
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

export function ColumnCards({ items, context, footnote }: ColumnCardsProps) {
  const { landing } = use(DragSourceContext);
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {items.map((application) => (
        <motion.div
          key={application.id}
          layout
          layoutId={application.id}
          {...FADE_PRESENCE}
          {...(isLanding(application, landing) && LANDING)}
        >
          <DraggableCard application={application} context={context} />
        </motion.div>
      ))}
      {footnote !== undefined && <ColumnNote key="footnote" lines={footnote} />}
      {footnote === undefined && items.length === 0 && (
        <ColumnNote
          key="empty"
          lines={uk.board.columnEmpty}
          className="in-data-[drop=over]:hidden"
        />
      )}
    </AnimatePresence>
  );
}
