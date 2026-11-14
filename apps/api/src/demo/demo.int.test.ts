import {
  DEFAULT_SEARCH_TITLE,
  DEFAULT_SILENCE_DAYS,
  silenceLevelOf,
  wholeDaysBetween,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { Clock } from '../common/clock.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AuthModule } from '../modules/auth/index.js';
import { PlansModule } from '../modules/plans/index.js';
import { ResumeVersionsRepository } from '../modules/resumes/index.js';
import { SearchesRepository } from '../modules/searches/index.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { SeedRepository } from '../seed/seed.repository.js';
import { DEMO_USER, SeedService } from '../seed/seed.service.js';
import { FileStorage } from '../storage/file-storage.js';
import { StorageModule } from '../storage/storage.module.js';
import { appTestingModule, useTestApp } from '../test/app.js';
import {
  createActiveResumeVersion,
  createAiJob,
  createAiResult,
  createOwnedApplication,
  createStageEvent,
  createUser,
} from '../test/factories.js';
import { createNotifications } from '../test/notifications.js';
import { fixedClock } from '../test/time.js';
import { DemoRepository } from './demo.repository.js';
import { DemoService } from './demo.service.js';
import { DemoCvFiles } from './demo-cv-files.service.js';
import { loadDemoStory, openDemoJourneys } from './demo-story.js';
import { DemoStoryWriter } from './demo-story-writer.service.js';

const PINNED_NOW = new Date('2026-11-20T10:30:00.000Z');

const STORY_TO_PINNED_MS = (84 * 24 * 60 - 90) * 60 * 1000;

const DEMO_DUMP_SELECT = {
  email: true,
  settings: { select: { timezone: true, activeResumeVersion: { select: { number: true } } } },
  searches: { select: { title: true, status: true, startedAt: true, createdAt: true } },
  resumes: { select: { title: true, createdAt: true } },
  resumeVersions: {
    orderBy: { number: 'asc' },
    select: {
      number: true,
      title: true,
      storageKey: true,
      sizeBytes: true,
      mime: true,
      uploadedAt: true,
      aiProfile: true,
    },
  },
  applications: {
    orderBy: { url: 'asc' },
    select: {
      company: true,
      url: true,
      source: true,
      currentStage: true,
      appliedAt: true,
      lastEventAt: true,
      matchScore: true,
      resumeVersion: { select: { number: true } },
      stageEvents: {
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        select: { fromStage: true, toStage: true, reasonCode: true, occurredAt: true },
      },
      notes: { select: { body: true, createdAt: true } },
      scheduledEvents: {
        orderBy: { startsAt: 'asc' },
        select: { kind: true, startsAt: true, status: true },
      },
      aiJobs: { select: { kind: true, status: true, aiResult: { select: { output: true } } } },
    },
  },
  aiJobs: {
    where: { kind: 'monthly_summary' },
    select: { status: true, createdAt: true, aiResult: { select: { output: true } } },
  },
  plans: { select: { title: true, month: true, items: { select: { title: true } } } },
} satisfies Prisma.UserSelect;

const demoDump = (prisma: PrismaService) =>
  prisma.user.findUniqueOrThrow({ where: { email: DEMO_USER.email }, select: DEMO_DUMP_SELECT });

const countBy = <Item>(items: Item[], keyOf: (item: Item) => string | null) =>
  items.reduce<Record<string, number>>((counts, item) => {
    const key = keyOf(item);
    return key === null ? counts : { ...counts, [key]: (counts[key] ?? 0) + 1 };
  }, {});

async function expectedJourneys() {
  const story = openDemoJourneys(await loadDemoStory());
  return story.applications.map(({ url, source, events }) => ({
    url,
    source,
    events: events.map((event) => ({
      ...event,
      occurredAt: new Date(event.occurredAt.getTime() + STORY_TO_PINNED_MS),
    })),
  }));
}

async function foreignRowsOf(prisma: PrismaService, userId: string) {
  const where = { userId };
  return {
    searches: await prisma.search.count({ where }),
    applications: await prisma.application.findMany({ where }),
    stageEvents: await prisma.stageEvent.count({ where: { application: where } }),
    resumeVersions: await prisma.resumeVersion.count({ where }),
    aiJobs: await prisma.aiJob.count({ where }),
    aiResults: await prisma.aiResult.count({ where }),
    notifications: await prisma.notification.count({ where }),
    plans: await prisma.plan.count({ where }),
    settings: await prisma.userSettings.findUnique({ where }),
  };
}

async function createForeignUser(prisma: PrismaService) {
  const { userId, applicationId } = await createOwnedApplication(prisma);
  await createStageEvent(prisma, applicationId);
  await createActiveResumeVersion(prisma, userId);
  const aiResultId = await createAiResult(prisma, { userId });
  await createAiJob(prisma, { userId, applicationId, status: 'done', aiResultId });
  await createNotifications(prisma, { userId, readAt: [null] });
  const month = new Date('2026-11-01T00:00:00.000Z');
  await prisma.plan.create({ data: { userId, aiResultId, title: 'План', month } });
  return userId;
}

describe('the demo story seed', () => {
  const testApp = useTestApp(() =>
    appTestingModule({
      imports: [AuthModule, PlansModule, StorageModule],
      providers: [
        SeedRepository,
        SeedService,
        DemoRepository,
        SearchesRepository,
        ResumeVersionsRepository,
        DemoStoryWriter,
        DemoService,
        DemoCvFiles,
        Clock,
      ],
    })
      .overrideProvider(Clock)
      .useValue(fixedClock(PINNED_NOW)),
  );

  const demo = () => testApp.app.get(DemoService);

  const seedDemo = async () => {
    const cvFiles = await demo().run();
    await testApp.app.get(DemoCvFiles).store(cvFiles);
    return cvFiles;
  };

  const cvHeads = async () => {
    const { resumeVersions } = await demoDump(testApp.prisma);
    const storage = testApp.app.get(FileStorage);
    return Promise.all(resumeVersions.map(({ storageKey }) => storage.head(storageKey)));
  };

  it('writes the 54 design journeys shifted to now with the withdrawn ones open, with their versions, summary, plan and offer call', async () => {
    await demo().run();

    const dump = await demoDump(testApp.prisma);
    const journeys = dump.applications.map(({ url, source, stageEvents }) => ({
      url,
      source,
      events: stageEvents,
    }));
    expect(journeys).toEqual(
      (await expectedJourneys()).sort((left, right) => left.url.localeCompare(right.url)),
    );
    expect(countBy(dump.applications, ({ currentStage }) => currentStage)).toEqual({
      rejected: 32,
      ghosted: 17,
      applied: 2,
      screening: 1,
      final: 1,
      offer: 1,
    });
    expect(
      countBy(dump.applications, ({ currentStage, lastEventAt }) =>
        silenceLevelOf({
          stage: currentStage,
          silenceDays: DEFAULT_SILENCE_DAYS,
          daysSinceLastEvent: wholeDaysBetween(lastEventAt, PINNED_NOW),
        }),
      ),
    ).toMatchObject({ silent: 3 });
    expect(countBy(dump.applications, ({ source }) => source)).toEqual({
      djinni: 24,
      linkedin: 16,
      dou: 6,
      robota: 3,
      referral: 3,
      company_site: 2,
    });
    expect(
      countBy(dump.applications, ({ resumeVersion }) => `v${String(resumeVersion?.number)}`),
    ).toEqual({
      v1: 21,
      v2: 27,
      v3: 6,
    });
    const reasons = dump.applications.flatMap(({ stageEvents }) => stageEvents);
    expect(countBy(reasons, ({ reasonCode }) => reasonCode)).toEqual({
      skills_gap: 6,
      english_level: 4,
      salary_expectations: 3,
      chose_other: 3,
      position_closed: 2,
      no_explanation: 2,
      low_salary: 2,
      office_schedule: 2,
      red_flags: 2,
      accepted_other: 2,
      silence_timeout: 2,
      unspecified: 2,
    });
    expect(reasons).toHaveLength(134);
  });

  it('starts the first journey 84 days minus 90 minutes after the story date', async () => {
    await demo().run();

    const dump = await demoDump(testApp.prisma);
    const earliest = dump.applications
      .map(({ appliedAt }) => appliedAt?.toISOString())
      .sort()
      .at(0);
    expect(earliest).toBe('2026-08-28T07:30:00.000Z');
    expect(dump.searches).toEqual([
      {
        title: DEFAULT_SEARCH_TITLE,
        status: 'active',
        startedAt: new Date('2026-08-28T04:30:00.000Z'),
        createdAt: new Date('2026-08-28T04:30:00.000Z'),
      },
    ]);
    expect(dump.resumes).toEqual([
      { title: 'Резюме', createdAt: new Date('2026-08-28T04:30:00.000Z') },
    ]);
  });

  it('adds three profiled resume versions with v2 active, one done summary with its plan and the planned offer call', async () => {
    const cvFiles = await seedDemo();

    const dump = await demoDump(testApp.prisma);
    expect(cvFiles.map(({ key, mime }) => ({ storageKey: key, mime }))).toEqual(
      dump.resumeVersions.map(({ storageKey, mime }) => ({ storageKey, mime })),
    );
    expect(
      (await cvHeads()).map((head) => ({ sizeBytes: head?.sizeBytes, mime: head?.mime })),
    ).toEqual(dump.resumeVersions.map(({ sizeBytes }) => ({ sizeBytes, mime: 'application/pdf' })));
    expect(dump.resumeVersions.map(({ number, title }) => `${String(number)} ${title}`)).toEqual([
      '1 хронологічне',
      '2 акцент на продукті',
      '3 для дизайн-ролей',
    ]);
    expect(dump.resumeVersions.every(({ aiProfile }) => aiProfile !== null)).toBe(true);
    expect(dump.settings).toEqual({ timezone: 'Europe/Kyiv', activeResumeVersion: { number: 2 } });
    expect(dump.aiJobs.map(({ status, createdAt }) => ({ status, createdAt }))).toEqual([
      { status: 'done', createdAt: new Date('2026-11-01T02:00:00.000Z') },
    ]);
    expect(
      dump.plans.map(({ title, month, items }) => ({ title, month, items: items.length })),
    ).toEqual([
      { title: 'План на листопад', month: new Date('2026-11-01T00:00:00.000Z'), items: 4 },
    ]);
    const scheduled = dump.applications.flatMap(({ scheduledEvents }) => scheduledEvents);
    expect(countBy(scheduled, ({ kind, status }) => `${kind} ${status}`)).toEqual({
      'tech_interview done': 9,
      'final_interview done': 4,
      'offer_call planned': 1,
    });
    expect(scheduled.filter(({ status }) => status === 'planned')).toEqual([
      { kind: 'offer_call', startsAt: new Date('2026-11-21T10:30:00.000Z'), status: 'planned' },
    ]);
    expect(dump.applications.filter(({ matchScore }) => matchScore !== null)).toHaveLength(54);
    const matchJobs = dump.applications.flatMap(({ aiJobs }) => aiJobs);
    expect(countBy(matchJobs, ({ kind, status }) => `${kind} ${status}`)).toEqual({
      'match done': 54,
    });
  });

  it('gives the same story and CV files on a second run and keeps the demo user', async () => {
    await seedDemo();
    const first = await demoDump(testApp.prisma);
    const firstHeads = await cvHeads();
    const { id } = await testApp.prisma.user.findUniqueOrThrow({
      where: { email: DEMO_USER.email },
    });

    await seedDemo();

    expect(await demoDump(testApp.prisma)).toEqual(first);
    expect(await cvHeads()).toEqual(firstHeads);
    expect(firstHeads.every((head) => head !== null)).toBe(true);
    const users = await testApp.prisma.user.findMany({ where: { email: DEMO_USER.email } });
    expect(users.map((user) => user.id)).toEqual([id]);
  });

  it("leaves another user's search, applications, resumes, AI rows, notifications and plans untouched", async () => {
    const userId = await createForeignUser(testApp.prisma);
    const before = await foreignRowsOf(testApp.prisma, userId);

    await demo().run();
    await demo().run();

    const after = await foreignRowsOf(testApp.prisma, userId);
    expect(after).toEqual(before);
    expect({ ...after, applications: after.applications.length, settings: null }).toEqual({
      searches: 1,
      applications: 1,
      stageEvents: 1,
      resumeVersions: 1,
      aiJobs: 1,
      aiResults: 1,
      notifications: 1,
      plans: 1,
      settings: null,
    });
  });

  it('keeps a demo user that existed before the run instead of registering it again', async () => {
    const existing = await createUser(testApp.prisma, { email: DEMO_USER.email });

    await demo().run();

    const users = await testApp.prisma.user.findMany({ where: { email: DEMO_USER.email } });
    expect(users).toEqual([existing]);
    expect((await demoDump(testApp.prisma)).applications).toHaveLength(54);
  });
});
