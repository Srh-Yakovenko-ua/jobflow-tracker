import type { Note, TimelineItem } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { formatDayMonth } from '@/shared/lib/state-format';

import { stageOf } from './timeline-rows';

export type NoteContextInput = Readonly<{
  note: Note;
  items: readonly TimelineItem[];
  timeZone: string;
}>;

const COPY = uk.applicationPage.notes;

function laterOf(last: TimelineItem | undefined, item: TimelineItem): TimelineItem {
  return last === undefined || Date.parse(item.occurredAt) > Date.parse(last.occurredAt)
    ? item
    : last;
}

function lastMoveUntil(items: readonly TimelineItem[], at: Date): TimelineItem | undefined {
  return items
    .filter((item) => item.type === 'stage_changed' && Date.parse(item.occurredAt) <= at.getTime())
    .reduce<TimelineItem | undefined>(laterOf, undefined);
}

export function noteContextOf({ note, items, timeZone }: NoteContextInput): string {
  const at = new Date(note.createdAt);
  const date = formatDayMonth({ at, timeZone });
  const stage = stageOf(lastMoveUntil(items, at)?.meta.toStage);
  return stage === null ? date : COPY.context(date, uk.timeline.stageGenitive[stage]);
}
