import { cn } from '@/shared/lib/cn';

import type { TimelineRow, TimelineTone } from '../lib/timeline-rows';
import { TimelineMarker, type TimelineMarkerKind } from './timeline-marker';

export type TimelineEntry = Pick<TimelineRow, 'id' | 'title' | 'meta' | 'tone'> & {
  marker: TimelineMarkerKind;
  when: { label: string; at: Date };
};

export type TimelineEntryRowProps = Readonly<{ entry: TimelineEntry }>;

const TITLE_TONE: Record<TimelineTone, string> = {
  strong: 'font-semibold',
  medium: 'font-medium',
  muted: 'font-medium text-ink-2',
};

export function TimelineEntryRow({ entry }: TimelineEntryRowProps) {
  return (
    <li className="group grid grid-cols-[64px_20px_minmax(0,1fr)] gap-x-3.5">
      <time
        dateTime={entry.when.at.toISOString()}
        className="pt-0.75 text-[11px] font-semibold text-ink-3 tabular-nums"
      >
        {entry.when.label}
      </time>
      <span aria-hidden className="flex flex-col items-center">
        <TimelineMarker marker={entry.marker} />
        <span className="w-px flex-1 bg-line-soft group-last:hidden" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.75 pb-5.5 wrap-anywhere group-last:pb-0">
        <p className={cn('text-[14.5px]', TITLE_TONE[entry.tone])}>{entry.title}</p>
        {entry.meta !== null && (
          <p className="text-[13px] leading-normal text-ink-3">{entry.meta}</p>
        )}
      </div>
    </li>
  );
}
