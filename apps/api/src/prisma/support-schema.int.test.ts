import { describe, expect, it } from 'vitest';

import { useTestDatabase } from '../test/database.js';
import { createOwnedApplication, createUser, type OwnedApplication } from '../test/factories.js';
import type { PrismaService } from './prisma.service.js';

const AI_RESULT = {
  kind: 'parse_vacancy',
  inputHash: 'sha256:abc',
  promptVersion: 'v1',
  model: 'test-model',
  tokensIn: 120,
  tokensOut: 40,
  latencyMs: 900,
  status: 'succeeded',
} as const;

async function createResumeVersion(prisma: PrismaService, userId: string): Promise<string> {
  const resume = await prisma.resume.create({ data: { userId, title: 'Backend CV' } });
  const version = await prisma.resumeVersion.create({
    data: {
      resumeId: resume.id,
      storageKey: `resumes/${resume.id}/v1.pdf`,
      filename: 'cv.pdf',
      mime: 'application/pdf',
      sizeBytes: 2048,
      title: 'v1',
    },
  });
  return version.id;
}

async function attachResumeVersion(
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

async function fillUserOwnedTables(prisma: PrismaService, owned: OwnedApplication): Promise<void> {
  const { userId, applicationId } = owned;
  const resumeVersionId = await attachResumeVersion(prisma, owned);
  const aiResult = await prisma.aiResult.create({ data: { ...AI_RESULT, userId } });
  await prisma.aiJob.create({
    data: { userId, kind: AI_RESULT.kind, aiResultId: aiResult.id, applicationId, resumeVersionId },
  });
  await prisma.reminder.create({
    data: { userId, applicationId, type: 'followup', dueAt: new Date('2026-10-26T09:00:00Z') },
  });
  await prisma.notification.create({ data: { userId, type: 'silence' } });
  await prisma.pushSubscription.create({
    data: { userId, endpoint: 'https://push.example.test/1', p256dh: 'key', auth: 'secret' },
  });
  await prisma.idempotencyKey.create({ data: { userId, key: 'k-1', requestHash: 'h-1' } });
  await prisma.plan.create({
    data: {
      userId,
      aiResultId: aiResult.id,
      title: 'Жовтень',
      month: new Date('2026-10-01'),
      items: { create: { position: 0, title: 'Оновити CV' } },
    },
  });
}

async function countUserOwnedRows(prisma: PrismaService, userId: string): Promise<number[]> {
  const where = { userId };
  return Promise.all([
    prisma.resume.count({ where }),
    prisma.resumeVersion.count({ where: { resume: where } }),
    prisma.aiResult.count({ where }),
    prisma.aiJob.count({ where }),
    prisma.reminder.count({ where }),
    prisma.notification.count({ where }),
    prisma.pushSubscription.count({ where }),
    prisma.idempotencyKey.count({ where }),
    prisma.plan.count({ where }),
    prisma.planItem.count({ where: { plan: where } }),
  ]);
}

describe('the supporting tables in Postgres', () => {
  const database = useTestDatabase();

  it('refuses a second AI result with the same user, kind and input hash', async () => {
    const { prisma } = database;
    const { id: userId } = await createUser(prisma);
    await prisma.aiResult.create({ data: { ...AI_RESULT, userId } });

    await expect(prisma.aiResult.create({ data: { ...AI_RESULT, userId } })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('accepts an AI result for the same input under another kind', async () => {
    const { prisma } = database;
    const { id: userId } = await createUser(prisma);
    await prisma.aiResult.create({ data: { ...AI_RESULT, userId } });

    const other = await prisma.aiResult.create({
      data: { ...AI_RESULT, userId, kind: 'match_score' },
    });

    expect(other.kind).toBe('match_score');
  });

  it('deleting a user removes every supporting row, an active and attached resume version included', async () => {
    const { prisma } = database;
    const owned = await createOwnedApplication(prisma);
    await fillUserOwnedTables(prisma, owned);

    await prisma.user.delete({ where: { id: owned.userId } });

    expect(await countUserOwnedRows(prisma, owned.userId)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('deleting a resume version detaches it from the application and the settings', async () => {
    const { prisma } = database;
    const owned = await createOwnedApplication(prisma);
    const resumeVersionId = await attachResumeVersion(prisma, owned);

    await prisma.resumeVersion.delete({ where: { id: resumeVersionId } });

    const application = await prisma.application.findUniqueOrThrow({
      where: { id: owned.applicationId },
    });
    const settings = await prisma.userSettings.findUniqueOrThrow({
      where: { userId: owned.userId },
    });
    expect([application.resumeVersionId, settings.activeResumeVersionId]).toEqual([null, null]);
  });
});
