import type { AiKind } from '@jobflow/shared';

import type { Prisma } from '../generated/prisma/client.js';
import { LATEST_AI_JOB_SELECT, UNSETTLED_AI_JOB_WHERE } from './latest-ai-job.js';

export type OwnedApplication = { userId: string; applicationId: string };

export type RunningAiJobWindow = { resumeVersionId: string; since: Date };

export type RunningAiJobLock = OwnedApplication & { kind: AiKind; within?: RunningAiJobWindow };

export type LockedAiJob = { runningJobId: string | null };

export async function lockOwnedApplication(
  tx: Prisma.TransactionClient,
  { userId, applicationId }: OwnedApplication,
): Promise<boolean> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM applications
    WHERE id = ${applicationId}::uuid AND user_id = ${userId}::uuid AND deleted_at IS NULL
    FOR UPDATE`;
  return locked.length > 0;
}

export async function lockWithRunningAiJob(
  tx: Prisma.TransactionClient,
  { userId, applicationId, kind, within }: RunningAiJobLock,
): Promise<LockedAiJob | null> {
  if (!(await lockOwnedApplication(tx, { userId, applicationId }))) {
    return null;
  }
  const inWindow =
    within === undefined
      ? {}
      : { resumeVersionId: within.resumeVersionId, createdAt: { gte: within.since } };
  const running = await tx.aiJob.findFirst({
    where: { userId, applicationId, kind, ...inWindow, ...UNSETTLED_AI_JOB_WHERE },
    ...LATEST_AI_JOB_SELECT,
  });
  return { runningJobId: running?.id ?? null };
}
