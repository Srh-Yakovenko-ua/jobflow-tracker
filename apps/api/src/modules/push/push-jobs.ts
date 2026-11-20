import { pushMessageSchema } from '@jobflow/shared';
import type { Job, Queue } from 'bullmq';
import { z } from 'zod';

import { withinLimit } from '../../common/probe.js';
import { OUTBOX_LIMITS } from '../../outbox/outbox-relay.service.js';

export const PUSH_JOBS = { send: 'push.send' } as const;

export const pushSendJobSchema = z.object({ userId: z.uuid(), message: pushMessageSchema });

export type PushSendJob = z.infer<typeof pushSendJobSchema>;

export type DelayedPushSend = { job: PushSendJob; notificationId: string; delayMs: number };

export function queuePushSend(
  queue: Queue,
  { job, notificationId, delayMs }: DelayedPushSend,
): Promise<Job> {
  const added = queue.add(PUSH_JOBS.send, job, { jobId: notificationId, delay: delayMs });
  return withinLimit(added, OUTBOX_LIMITS.publishTimeoutMs);
}
