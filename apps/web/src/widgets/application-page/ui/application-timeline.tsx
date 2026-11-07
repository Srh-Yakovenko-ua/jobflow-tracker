import type { ApplicationResponse } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';

import { formatTimelineDate } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { TextSkeleton } from '@/shared/ui/skeleton';
import { STATE_TEXT } from '@/shared/ui/state-text';

import {
  type ApplicationTimelineState,
  useApplicationTimeline,
} from '../model/use-application-timeline';
import { ApplicationSection } from './application-section';
import { type TimelineEntry, TimelineEntryRow } from './timeline-row';

export type ApplicationTimelineProps = Readonly<{ application: ApplicationResponse }>;

type TimelineBodyProps = Readonly<{ timeline: ApplicationTimelineState }>;

const COPY = uk.timeline;

const WAITING_ID = 'waiting';

function entriesOf({ rows, waiting, now, timeZone }: ApplicationTimelineState): TimelineEntry[] {
  const dated = rows.map((row) => ({
    ...row,
    when: { label: formatTimelineDate({ at: row.at, now, timeZone }), at: row.at },
  }));
  if (waiting === null) return dated;
  const today: TimelineEntry = {
    id: WAITING_ID,
    ...waiting,
    metaFormat: 'text',
    tone: 'strong',
    marker: { kind: 'waiting' },
    when: { label: COPY.today, at: now },
  };
  return [today, ...dated];
}

function TimelineBody({ timeline }: TimelineBodyProps) {
  const { load } = timeline;
  if (load.pending) return <TextSkeleton />;
  if (load.failed) return <LoadFailedPanel onRetry={load.onRetry} />;
  const entries = entriesOf(timeline);
  if (entries.length === 0) {
    return <p className="animate-fade-in text-[13px] text-ink-3">{COPY.empty}</p>;
  }
  return (
    <ol className="relative flex animate-fade-in flex-col">
      <AnimatePresence mode="popLayout" initial={false}>
        {entries.map((entry) => (
          <TimelineEntryRow key={entry.id} entry={entry} />
        ))}
      </AnimatePresence>
    </ol>
  );
}

export function ApplicationTimeline({ application }: ApplicationTimelineProps) {
  const timeline = useApplicationTimeline(application);
  const { pending, failed } = timeline.load;
  const kicker = !failed && (
    <p
      className={cn(
        STATE_TEXT.eyebrow,
        'text-ink-3 tabular-nums',
        pending ? 'invisible' : 'animate-fade-in',
      )}
    >
      {COPY.kicker(timeline.count)}
    </p>
  );
  return (
    <ApplicationSection
      title={{ text: COPY.heading, look: 'display' }}
      header={{ before: kicker, className: 'flex flex-col gap-1' }}
      view={{
        className: 'flex flex-col gap-5 pt-5 shadow-[inset_0_1px_0_var(--line-soft)]',
        busy: pending,
      }}
    >
      <TimelineBody timeline={timeline} />
    </ApplicationSection>
  );
}
