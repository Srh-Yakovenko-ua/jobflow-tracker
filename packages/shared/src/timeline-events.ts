import { z } from 'zod';

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
