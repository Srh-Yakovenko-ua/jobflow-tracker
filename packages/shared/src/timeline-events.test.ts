import { describe, expect, it } from 'vitest';

import { timelineMetaSchema } from './schemas/timeline.js';
import { issuePathsOf } from './test/zod-issues.js';
import {
  TIMELINE_EVENT_KINDS,
  type TimelineEventKind,
  type TimelineRecord,
  timelineRecordSchema,
} from './timeline-events.js';

const VALID_PAYLOADS: {
  [Kind in TimelineEventKind]: Extract<TimelineRecord, { kind: Kind }>['payload'];
} = {
  captured: { method: 'bookmarklet' },
  ai_parsed: { durationSec: 4 },
  silence_started: { silenceDays: 10 },
  followup_generated: {},
  followup_sent: {},
  interview_scheduled: { kind: 'final_interview', startsAt: '2026-11-04T08:30:00.000Z' },
  interview_done: { kind: 'screening_call', durationMin: 45 },
  note_added: { noteId: '01920000-0000-7000-8000-000000000050' },
  resume_attached: { resumeVersionId: '01920000-0000-7000-8000-000000000051' },
};

describe('timelineRecordSchema', () => {
  it.for(TIMELINE_EVENT_KINDS)(
    'parses the %s record, and its payload fits an item meta',
    (kind) => {
      const record = { kind, payload: VALID_PAYLOADS[kind] };

      expect(timelineRecordSchema.parse(record)).toEqual(record);
      expect(timelineMetaSchema.parse(record.payload)).toEqual(record.payload);
    },
  );

  it('refuses an ai_parsed record whose durationSec is not a positive whole number', () => {
    const record = { kind: 'ai_parsed', payload: { durationSec: 1.5 } };

    expect(issuePathsOf(timelineRecordSchema.safeParse(record))).toEqual(['payload.durationSec']);
  });

  it('refuses a kind outside the timeline event kinds', () => {
    const record = { kind: 'email_opened', payload: {} };

    expect(issuePathsOf(timelineRecordSchema.safeParse(record))).toEqual(['kind']);
  });
});
