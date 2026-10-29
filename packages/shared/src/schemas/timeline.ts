import { z } from 'zod';

import { TIMELINE_EVENT_KINDS } from '../timeline-events.js';

export const TIMELINE_ITEM_TYPES = ['stage_changed', ...TIMELINE_EVENT_KINDS] as const;

export const timelineItemTypeSchema = z.enum(TIMELINE_ITEM_TYPES);

export type TimelineItemType = z.infer<typeof timelineItemTypeSchema>;

export const TIMELINE_ACTORS = ['user', 'system'] as const;

export const timelineActorSchema = z.enum(TIMELINE_ACTORS);

export type TimelineActor = z.infer<typeof timelineActorSchema>;

export const timelineMetaSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

export const timelineItemSchema = z.object({
  id: z.uuid(),
  type: timelineItemTypeSchema,
  occurredAt: z.iso.datetime(),
  title: z.string().min(1),
  meta: timelineMetaSchema,
  actor: timelineActorSchema,
});

export const applicationTimelineResponseSchema = z.object({
  items: z.array(timelineItemSchema),
});

export type TimelineItem = z.infer<typeof timelineItemSchema>;
export type ApplicationTimelineResponse = z.infer<typeof applicationTimelineResponseSchema>;
