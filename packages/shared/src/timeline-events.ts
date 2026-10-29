import { z } from 'zod';

import { scheduledEventKindSchema, scheduledEventSlotSchema } from './scheduled-events.js';

export const TIMELINE_EVENT_KINDS = [
  'captured',
  'ai_parsed',
  'silence_started',
  'followup_generated',
  'followup_sent',
  'interview_scheduled',
  'interview_done',
  'note_added',
  'resume_attached',
] as const;

export const timelineEventKindSchema = z.enum(TIMELINE_EVENT_KINDS);

export type TimelineEventKind = z.infer<typeof timelineEventKindSchema>;

export const CAPTURE_METHODS = ['bookmarklet', 'paste'] as const;

export const captureMethodSchema = z.enum(CAPTURE_METHODS);

export type CaptureMethod = z.infer<typeof captureMethodSchema>;

function timelineRecordOf<Kind extends TimelineEventKind, Payload extends z.ZodRawShape>(
  kind: Kind,
  payload: Payload,
) {
  return z.object({ kind: z.literal(kind), payload: z.object(payload) });
}

export const timelineRecordSchema = z.discriminatedUnion('kind', [
  timelineRecordOf('captured', { method: captureMethodSchema }),
  timelineRecordOf('ai_parsed', { durationSec: z.int().positive() }),
  timelineRecordOf('silence_started', { silenceDays: z.int().positive() }),
  timelineRecordOf('followup_generated', {}),
  timelineRecordOf('followup_sent', {}),
  timelineRecordOf('interview_scheduled', scheduledEventSlotSchema.shape),
  timelineRecordOf('interview_done', {
    kind: scheduledEventKindSchema,
    durationMin: z.int().positive(),
  }),
  timelineRecordOf('note_added', { noteId: z.uuid() }),
  timelineRecordOf('resume_attached', { resumeVersionId: z.uuid() }),
]);

export type TimelineRecord = z.infer<typeof timelineRecordSchema>;
