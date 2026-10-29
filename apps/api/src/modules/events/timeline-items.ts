import {
  type TimelineActor,
  type TimelineEventKind,
  type TimelineItem,
  timelineRecordSchema,
  wholeDaysBetween,
} from '@jobflow/shared';

import type { TimelineRows } from './timeline.repository.js';
import { NOTE_TITLE, recordTitle, stageChangeTitle } from './timeline-titles.js';

type StageEventRow = TimelineRows['stageEvents'][number];

type JournalRow = TimelineRows['timelineEvents'][number];

type NoteRow = TimelineRows['notes'][number];

const JOURNAL_ACTORS: Record<TimelineEventKind, TimelineActor> = {
  captured: 'user',
  ai_parsed: 'system',
  silence_started: 'system',
  followup_generated: 'system',
  followup_sent: 'user',
  interview_scheduled: 'user',
  interview_done: 'user',
  note_added: 'user',
  resume_attached: 'user',
};

function stageItem(event: StageEventRow, previous: StageEventRow | undefined): TimelineItem {
  const { id, fromStage, toStage, reasonCode, comment, occurredAt } = event;
  return {
    id,
    type: 'stage_changed',
    occurredAt: occurredAt.toISOString(),
    title: stageChangeTitle(event),
    meta: {
      fromStage,
      toStage,
      reasonCode,
      comment,
      daysInPreviousStage:
        previous === undefined ? null : wholeDaysBetween(previous.occurredAt, occurredAt),
    },
    actor: 'user',
  };
}

function journalItem({ id, kind, payload, occurredAt }: JournalRow): TimelineItem {
  const record = timelineRecordSchema.parse({ kind, payload });
  return {
    id,
    type: record.kind,
    occurredAt: occurredAt.toISOString(),
    title: recordTitle(record),
    meta: record.payload,
    actor: JOURNAL_ACTORS[record.kind],
  };
}

function noteItem({ id, body, createdAt }: NoteRow): TimelineItem {
  return {
    id,
    type: 'note_added',
    occurredAt: createdAt.toISOString(),
    title: NOTE_TITLE,
    meta: { body },
    actor: 'user',
  };
}

function newestFirst(left: TimelineItem, right: TimelineItem): number {
  const byTime = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
  return byTime === 0 ? right.id.localeCompare(left.id) : byTime;
}

export function timelineItemsOf({
  stageEvents,
  timelineEvents,
  notes,
}: TimelineRows): TimelineItem[] {
  return [
    ...stageEvents.map((event, index) => stageItem(event, stageEvents[index + 1])),
    ...timelineEvents.map(journalItem),
    ...notes.map(noteItem),
  ].sort(newestFirst);
}
