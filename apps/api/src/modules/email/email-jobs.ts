import type { Job, Queue } from 'bullmq';
import { z } from 'zod';

import { withinLimit } from '../../common/probe.js';
import { OUTBOX_LIMITS } from '../../outbox/outbox-relay.service.js';

export const EMAIL_JOBS = { send: 'email.send' } as const;

export const emailSendJobSchema = z.object({ userId: z.uuid(), notificationId: z.uuid() });

export type EmailSendJob = z.infer<typeof emailSendJobSchema>;

export type DelayedEmailSend = { job: EmailSendJob; delayMs: number };

export function queueEmailSend(queue: Queue, { job, delayMs }: DelayedEmailSend): Promise<Job> {
  const added = queue.add(EMAIL_JOBS.send, job, { jobId: job.notificationId, delay: delayMs });
  return withinLimit(added, OUTBOX_LIMITS.publishTimeoutMs);
}
