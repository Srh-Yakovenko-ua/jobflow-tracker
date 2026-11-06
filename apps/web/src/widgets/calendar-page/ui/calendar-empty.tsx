import Link from 'next/link';

import { FEATURE_FLAGS, type FeatureFlags } from '@/shared/config';
import { uk } from '@/shared/i18n';
import { buttonLinkClasses } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';

const COPY = uk.calendarPage;

const SILENT_CARDS_HREF = '/board?silence=silent';

function nextStepOf(flags: FeatureFlags) {
  return flags.reminders
    ? { href: '/reminders', label: COPY.toReminders }
    : { href: SILENT_CARDS_HREF, label: COPY.toSilentCards };
}

export type EmptyWeek = Readonly<{ silentCount: number; current: boolean }>;

export type CalendarEmptyProps = Readonly<{ week: EmptyWeek }>;

export function CalendarEmpty({ week }: CalendarEmptyProps) {
  const next = nextStepOf(FEATURE_FLAGS);
  const title = week.current ? COPY.emptyWeek.current : COPY.emptyWeek.other;
  return (
    <EmptyState
      content={{ title, hint: uk.shell.silentBadge(week.silentCount) }}
      slots={{
        action: (
          <Link href={next.href} className={buttonLinkClasses({ variant: 'ghost', size: 'sm' })}>
            {next.label}
          </Link>
        ),
      }}
      view={{ size: 'compact' }}
    />
  );
}
