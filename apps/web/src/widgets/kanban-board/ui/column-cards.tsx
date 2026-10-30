import type { ApplicationCard as ApplicationCardData } from '@jobflow/shared';

import { ApplicationCard, type ApplicationCardContext } from '@/entities/application';
import { uk } from '@/shared/i18n';

export type ColumnCardsProps = Readonly<{
  items: readonly ApplicationCardData[];
  context: ApplicationCardContext;
  footnote?: readonly string[] | undefined;
}>;

function ColumnNote({ lines }: Readonly<{ lines: readonly string[] }>) {
  return (
    <p className="flex min-h-16.5 flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-line p-3 text-center text-[12px] leading-[1.5] text-ink-3">
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </p>
  );
}

export function ColumnCards({ items, context, footnote }: ColumnCardsProps) {
  const note = footnote ?? (items.length === 0 ? uk.board.columnEmpty : undefined);
  return (
    <>
      {items.map((application) => (
        <ApplicationCard key={application.id} application={application} context={context} />
      ))}
      {note !== undefined && <ColumnNote lines={note} />}
    </>
  );
}
