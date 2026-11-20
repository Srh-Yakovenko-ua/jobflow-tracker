import type { ApplicationResponse } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';
import { useId } from 'react';

import { formatTimelineDate } from '@/entities/application';
import { AskedTopicsQuestion } from '@/features/log-interview-topics';
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

type TimelineBodyProps = Readonly<{
  application: ApplicationResponse;
  timeline: ApplicationTimelineState;
  onAskedClosed: () => void;
}>;

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

function TimelineBody({ application, timeline, onAskedClosed }: TimelineBodyProps) {
  const { load } = timeline;
  if (load.pending) return <TextSkeleton />;
  if (load.failed) return <LoadFailedPanel load={load} />;
  const entries = entriesOf(timeline);
  if (entries.length === 0) {
    return <p className="animate-fade-in text-[13px] text-ink-3">{COPY.empty}</p>;
  }
  return (
    <ol className="relative flex animate-fade-in flex-col">
      <AnimatePresence mode="popLayout" initial={false}>
        {entries.map((entry) => (
          <TimelineEntryRow key={entry.id} entry={entry}>
            {entry.id === timeline.latestInterviewId && (
              <AskedTopicsQuestion
                application={application}
                itemId={entry.id}
                actions={{ onClosed: onAskedClosed }}
              />
            )}
          </TimelineEntryRow>
        ))}
      </AnimatePresence>
    </ol>
  );
}

export function ApplicationTimeline({ application }: ApplicationTimelineProps) {
  const timeline = useApplicationTimeline(application);
  const headingId = useId();
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
      title={{ text: COPY.heading, look: 'display', focusId: headingId }}
      header={{ before: kicker, className: 'flex flex-col gap-1' }}
      view={{
        className: 'flex flex-col gap-5 pt-5 shadow-[inset_0_1px_0_var(--line-soft)]',
        busy: timeline.load.busy,
      }}
    >
      <TimelineBody
        application={application}
        timeline={timeline}
        onAskedClosed={() => {
          document.getElementById(headingId)?.focus();
        }}
      />
    </ApplicationSection>
  );
}
