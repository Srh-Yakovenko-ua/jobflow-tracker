import { describe, expect, it } from 'vitest';

import { useTestDatabase } from '../test/database.js';
import {
  compensationOf,
  createOwnedApplication,
  createStageEvent,
  createUser,
  type OwnedApplication,
} from '../test/factories.js';
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

const FOLLOWUP = { type: 'followup', dueAt: new Date('2026-10-26T09:00:00Z') } as const;

const PLAN = { title: 'Жовтень', month: new Date('2026-10-01') };

type ResumeOwner = { userId: string; resumeId: string };

type OwnerPairs = { mine: OwnedApplication; theirs: OwnedApplication };

type OwnerCheckedRow = {
  row: string;
  target: string;
  create: (prisma: PrismaService, owners: OwnerPairs) => Promise<unknown>;
};

async function createResume(prisma: PrismaService, userId: string): Promise<string> {
  const resume = await prisma.resume.create({ data: { userId, title: 'Backend CV' } });
  return resume.id;
}

function resumeVersionData(owner: ResumeOwner) {
  return {
    ...owner,
    storageKey: `resumes/${owner.resumeId}/v1.pdf`,
    filename: 'cv.pdf',
    mime: 'application/pdf',
    sizeBytes: 2048,
    title: 'v1',
  };
}

async function createResumeVersion(prisma: PrismaService, userId: string): Promise<string> {
  const resumeId = await createResume(prisma, userId);
  const version = await prisma.resumeVersion.create({
    data: resumeVersionData({ userId, resumeId }),
  });
  return version.id;
}

async function createAiResult(prisma: PrismaService, userId: string): Promise<string> {
  const aiResult = await prisma.aiResult.create({ data: { ...AI_RESULT, userId } });
  return aiResult.id;
}

async function createScheduledEvent(prisma: PrismaService, applicationId: string): Promise<string> {
  const event = await prisma.scheduledEvent.create({
    data: { applicationId, kind: 'tech_interview', startsAt: new Date('2026-10-28T10:00:00Z') },
  });
  return event.id;
}

const OWNER_CHECKED_ROWS: OwnerCheckedRow[] = [
  {
    row: 'a reminder',
    target: "another user's application",
    create: (prisma, { mine, theirs }) =>
      prisma.reminder.create({
        data: { userId: mine.userId, applicationId: theirs.applicationId, ...FOLLOWUP },
      }),
  },
  {
    row: 'an AI job',
    target: "another user's application",
    create: (prisma, { mine, theirs }) =>
      prisma.aiJob.create({
        data: { userId: mine.userId, applicationId: theirs.applicationId, kind: AI_RESULT.kind },
      }),
  },
  {
    row: 'an application',
    target: "another user's search",
    create: (prisma, { mine, theirs }) =>
      prisma.application.create({
        data: {
          userId: mine.userId,
          searchId: theirs.searchId,
          company: 'Acme',
          position: 'QA',
          source: 'dou',
        },
      }),
  },
  {
    row: 'a compensating stage event',
    target: "another application's event",
    create: async (prisma, { mine, theirs }) =>
      prisma.stageEvent.create({
        data: compensationOf({
          applicationId: mine.applicationId,
          compensatesEventId: await createStageEvent(prisma, theirs.applicationId),
        }),
      }),
  },
  {
    row: 'an AI job',
    target: "another user's AI result",
    create: async (prisma, { mine, theirs }) =>
      prisma.aiJob.create({
        data: {
          userId: mine.userId,
          kind: AI_RESULT.kind,
          aiResultId: await createAiResult(prisma, theirs.userId),
        },
      }),
  },
  {
    row: 'a plan',
    target: "another user's AI result",
    create: async (prisma, { mine, theirs }) =>
      prisma.plan.create({
        data: {
          userId: mine.userId,
          aiResultId: await createAiResult(prisma, theirs.userId),
          ...PLAN,
        },
      }),
  },
  {
    row: 'a reminder',
    target: "another application's scheduled event",
    create: async (prisma, { mine, theirs }) =>
      prisma.reminder.create({
        data: {
          userId: mine.userId,
          applicationId: mine.applicationId,
          type: 'interview_soon',
          dueAt: new Date('2026-10-27T10:00:00Z'),
          scheduledEventId: await createScheduledEvent(prisma, theirs.applicationId),
        },
      }),
  },
  {
    row: 'a resume version',
    target: "another user's resume",
    create: async (prisma, { mine, theirs }) =>
      prisma.resumeVersion.create({
        data: resumeVersionData({
          userId: mine.userId,
          resumeId: await createResume(prisma, theirs.userId),
        }),
      }),
  },
  {
    row: 'an application update',
    target: "another user's resume version",
    create: async (prisma, { mine, theirs }) =>
      prisma.application.update({
        where: { id: mine.applicationId },
        data: { resumeVersionId: await createResumeVersion(prisma, theirs.userId) },
      }),
  },
  {
    row: 'a user settings update',
    target: "another user's resume version",
    create: async (prisma, { mine, theirs }) =>
      prisma.userSettings.update({
        where: { userId: mine.userId },
        data: { activeResumeVersionId: await createResumeVersion(prisma, theirs.userId) },
      }),
  },
  {
    row: 'an AI job',
    target: "another user's resume version",
    create: async (prisma, { mine, theirs }) =>
      prisma.aiJob.create({
        data: {
          userId: mine.userId,
          kind: AI_RESULT.kind,
          resumeVersionId: await createResumeVersion(prisma, theirs.userId),
        },
      }),
  },
];

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
  const aiResultId = await createAiResult(prisma, userId);
  await prisma.aiJob.create({
    data: { userId, kind: AI_RESULT.kind, aiResultId, applicationId, resumeVersionId },
  });
  await prisma.reminder.create({ data: { userId, applicationId, ...FOLLOWUP } });
  await prisma.notification.create({ data: { userId, type: 'silence' } });
  await prisma.pushSubscription.create({
    data: { userId, endpoint: 'https://push.example.test/1', p256dh: 'key', auth: 'secret' },
  });
  await prisma.idempotencyKey.create({ data: { userId, key: 'k-1', requestHash: 'h-1' } });
  await prisma.plan.create({
    data: { userId, aiResultId, ...PLAN, items: { create: { position: 0, title: 'Оновити CV' } } },
  });
}

async function countUserOwnedRows(prisma: PrismaService, userId: string): Promise<number[]> {
  const where = { userId };
  return Promise.all([
    prisma.resume.count({ where }),
    prisma.resumeVersion.count({ where }),
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
    expect(application.userId).toBe(owned.userId);
  });

  it('deleting an AI result detaches it from the AI job and the plan and keeps their owner', async () => {
    const { prisma } = database;
    const { id: userId } = await createUser(prisma);
    const aiResultId = await createAiResult(prisma, userId);
    const job = await prisma.aiJob.create({ data: { userId, kind: AI_RESULT.kind, aiResultId } });
    const plan = await prisma.plan.create({ data: { userId, aiResultId, ...PLAN } });

    await prisma.aiResult.delete({ where: { id: aiResultId } });

    const detached = await Promise.all([
      prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } }),
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
    ]);
    expect(detached.map((row) => [row.userId, row.aiResultId])).toEqual([
      [userId, null],
      [userId, null],
    ]);
  });

  it('lets the analytics role read the owner of a resume version but not its text', async () => {
    const rows = await database.prisma.$queryRaw<{ owner: boolean; extracted_text: boolean }[]>`
      SELECT
        has_column_privilege('jobflow_analytics', 'resume_versions', 'user_id', 'SELECT') AS owner,
        has_column_privilege('jobflow_analytics', 'resume_versions', 'text_extracted', 'SELECT')
          AS extracted_text`;

    expect(rows).toEqual([{ owner: true, extracted_text: false }]);
  });
});

describe('owner consistent references and the one active reminder', () => {
  const database = useTestDatabase();

  it.each(OWNER_CHECKED_ROWS)('refuses $row that points at $target', async ({ create }) => {
    const { prisma } = database;
    const mine = await createOwnedApplication(prisma);
    const theirs = await createOwnedApplication(prisma);

    await expect(create(prisma, { mine, theirs })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('refuses a second pending followup for the same application', async () => {
    const { prisma } = database;
    const { userId, applicationId } = await createOwnedApplication(prisma);
    await prisma.reminder.create({ data: { userId, applicationId, ...FOLLOWUP } });

    await expect(
      prisma.reminder.create({ data: { userId, applicationId, ...FOLLOWUP } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('accepts a new pending followup once the first one is done', async () => {
    const { prisma } = database;
    const { userId, applicationId } = await createOwnedApplication(prisma);
    const first = await prisma.reminder.create({ data: { userId, applicationId, ...FOLLOWUP } });
    await prisma.reminder.update({ where: { id: first.id }, data: { status: 'done' } });

    const next = await prisma.reminder.create({ data: { userId, applicationId, ...FOLLOWUP } });

    expect(next.status).toBe('pending');
  });
});
