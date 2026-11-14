import { uk } from '@/shared/i18n';
import { EmptyState } from '@/shared/ui/empty-state';

const COPY = uk.notifications;

export type RemindersEmptyProps = Readonly<{ silenceDays: number }>;

function NobodySilent() {
  return (
    <p className="flex items-center gap-2.25 text-[13px] text-offer tabular-nums">
      <span aria-hidden className="size-2.25 flex-none rounded-pill bg-offer" />
      {COPY.silentCards(0)}
    </p>
  );
}

export function RemindersEmpty({ silenceDays }: RemindersEmptyProps) {
  const { eyebrow, title, hint } = COPY.empty;
  return (
    <EmptyState
      content={{ eyebrow, title, hint: hint(silenceDays) }}
      view={{ size: 'panel' }}
      slots={{ figure: <NobodySilent /> }}
    />
  );
}
