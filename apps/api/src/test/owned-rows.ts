import type { PrismaService } from '../prisma/prisma.service.js';
import { createAiResult, createResumeVersion, type OwnedApplication } from './factories.js';

export const AI_RESULT = {
  kind: 'parse_vacancy',
  inputHash: 'sha256:abc',
  promptVersion: 'v1',
  model: 'test-model',
  tokensIn: 120,
  tokensOut: 40,
  latencyMs: 900,
  status: 'succeeded',
} as const;

export const FOLLOWUP = { type: 'followup', dueAt: new Date('2026-10-26T09:00:00Z') } as const;

export const PLAN = { title: 'Жовтень', month: new Date('2026-10-01') };

export async function attachResumeVersion(
  prisma: PrismaService,
  owned: OwnedApplication,
): Promise<string> {
  const resumeVersionId = await createResumeVersion(prisma, owned.userId);
  await prisma.userSettings.update({
    where: { userId: owned.userId },
    data: { activeResumeVersionId: resumeVersionId },
  });
  await prisma.application.update({
    where: { id: owned.applicationId },
    data: { resumeVersionId },
  });
  return resumeVersionId;
}

export async function fillUserOwnedTables(
  prisma: PrismaService,
  owned: OwnedApplication,
): Promise<void> {
  const { userId, applicationId } = owned;
  const resumeVersionId = await attachResumeVersion(prisma, owned);
  const aiResultId = await createAiResult(prisma, { userId });
  await prisma.aiJob.create({
    data: { userId, kind: AI_RESULT.kind, aiResultId, applicationId, resumeVersionId },
  });
  await prisma.reminder.create({ data: { userId, applicationId, ...FOLLOWUP } });
  await prisma.notification.create({ data: { userId, type: 'silence' } });
  await prisma.pushSubscription.create({
    data: {
      userId,
      endpoint: `https://push.example.test/${userId}`,
      p256dh: 'key',
      auth: 'secret',
    },
  });
  await prisma.idempotencyKey.create({ data: { userId, key: 'k-1', requestHash: 'h-1' } });
  await prisma.plan.create({
    data: { userId, aiResultId, ...PLAN, items: { create: { position: 0, title: 'Оновити CV' } } },
  });
}
