import type { ApplicationCard as ApplicationCardData } from '@jobflow/shared';

import type { ApplicationCardContext } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { DraggableCard } from './draggable-card';

export type ColumnCardsProps = Readonly<{
  items: readonly ApplicationCardData[];
  context: ApplicationCardContext;
  footnote?: readonly string[] | undefined;
}>;

type ColumnNoteProps = Readonly<{ lines: readonly string[]; className?: string | undefined }>;

function ColumnNote({ lines, className }: ColumnNoteProps) {
  return (
    <p
      className={cn(
        'flex min-h-16.5 flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-line p-3 text-center text-[12px] leading-[1.5] text-ink-3',
        className,
      )}
    >
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </p>
  );
}

export function ColumnCards({ items, context, footnote }: ColumnCardsProps) {
  return (
    <>
      {items.map((application) => (
        <DraggableCard key={application.id} application={application} context={context} />
      ))}
      {footnote !== undefined && <ColumnNote lines={footnote} />}
      {footnote === undefined && items.length === 0 && (
        <ColumnNote lines={uk.board.columnEmpty} className="in-data-[drop=over]:hidden" />
      )}
    </>
  );
}
