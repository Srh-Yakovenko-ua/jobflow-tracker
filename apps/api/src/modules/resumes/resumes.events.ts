import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';

export const RESUME_EVENTS = {
  versionUploaded: 'resume.version_uploaded',
  attached: 'resume.attached',
} as const;

const resumeVersionEventSchema = z.object({
  userId: z.uuid(),
  resumeVersionId: z.uuid(),
});

export const resumeVersionUploadedPayloadSchema = resumeVersionEventSchema.extend({
  aiJobId: z.uuid(),
});

export const resumeAttachedPayloadSchema = resumeVersionEventSchema.extend({
  applicationId: z.uuid(),
});

export type ResumeVersionUploadedPayload = z.infer<typeof resumeVersionUploadedPayloadSchema>;

export type ResumeAttachedPayload = z.infer<typeof resumeAttachedPayloadSchema>;

export type ResumeEvent =
  | ({ eventType: typeof RESUME_EVENTS.versionUploaded } & Omit<
      ResumeVersionUploadedPayload,
      'userId'
    >)
  | ({ eventType: typeof RESUME_EVENTS.attached } & Omit<ResumeAttachedPayload, 'userId'>);

export function resumeEvent(
  userId: string,
  { eventType, ...change }: ResumeEvent,
): Prisma.OutboxEventCreateInput {
  return {
    aggregate: 'resume_version',
    aggregateId: change.resumeVersionId,
    eventType,
    payload: { userId, ...change },
  };
}
