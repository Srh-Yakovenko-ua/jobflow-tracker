import type { ApplicationResponse } from '@jobflow/shared';
import { useId } from 'react';

import { formatTimelineDate } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { TextSkeleton } from '@/shared/ui/skeleton';
import { STATE_TEXT } from '@/shared/ui/state-text';

import {
  type ApplicationTimeline as Timeline,
  useApplicationTimeline,
} from '../model/use-application-timeline';
import { type TimelineEntry, TimelineEntryRow } from './timeline-row';

export type ApplicationTimelineProps = Readonly<{ application: ApplicationResponse }>;

type TimelineBodyProps = Readonly<{ timeline: Timeline }>;

const COPY = uk.timeline;

const WAITING_ID = 'waiting';

function entriesOf({ rows, waiting, now, timeZone }: Timeline): TimelineEntry[] {
  const dated = rows.map((row) => ({
    ...row,
    when: { label: formatTimelineDate({ at: row.at, now, timeZone }), at: row.at },
  }));
  if (waiting === null) return dated;
  const today: TimelineEntry = {
    id: WAITING_ID,
    ...waiting,
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
  if (entries.length === 0) return <p className="text-[13px] text-ink-3">{COPY.empty}</p>;
  return (
    <ol className="flex flex-col">
      {entries.map((entry) => (
        <TimelineEntryRow key={entry.id} entry={entry} />
      ))}
    </ol>
  );
}

export function ApplicationTimeline({ application }: ApplicationTimelineProps) {
  const timeline = useApplicationTimeline(application);
  const headingId = useId();
  const { pending, failed } = timeline.load;
  return (
    <section
      aria-labelledby={headingId}
      aria-busy={pending || undefined}
      className="flex flex-col gap-5 pt-5 shadow-[inset_0_1px_0_var(--line-soft)]"
    >
      <div className="flex flex-col gap-1">
        {!pending && !failed && (
          <p className={cn(STATE_TEXT.eyebrow, 'text-ink-3 tabular-nums')}>
            {COPY.kicker(timeline.count)}
          </p>
        )}
        <h2 id={headingId} className="font-display text-[24px] leading-[1.2] font-medium">
          {COPY.heading}
        </h2>
      </div>
      <TimelineBody timeline={timeline} />
    </section>
  );
}
