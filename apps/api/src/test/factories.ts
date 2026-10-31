import { fakerUK as faker } from '@faker-js/faker';
import { SOURCES, type Stage, STAGES } from '@jobflow/shared';

import type {
  AiJobStatus,
  Prisma,
  ReminderStatus,
  ReminderType,
  ScheduledEventKind,
  ScheduledEventStatus,
  SearchStatus,
  User,
  UserSettings,
} from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { SeedRepository } from '../seed/seed.repository.js';
import { sharedRejectionReasons } from '../seed/seed.service.js';
import { minutesBefore } from './time.js';

export type OwnedApplication = { userId: string; searchId: string; applicationId: string };

export type NewSearch = { userId: string; status?: SearchStatus };

export type ApplicationRowInput = Omit<
  Partial<Prisma.ApplicationCreateManyInput>,
  'userId' | 'searchId' | 'lastEventAt'
> & { lastEventAt: Date };

export type NewApplicationRows = { userId: string; searchId: string; rows: ApplicationRowInput[] };

export type NewScheduledEvent = {
  applicationId: string;
  kind: ScheduledEventKind;
  startsAt: Date;
  durationMin?: number;
  status?: ScheduledEventStatus;
};

export type NewReminder = {
  userId: string;
  applicationId: string;
  dueAt: Date;
  type?: ReminderType;
  status?: ReminderStatus;
  snoozedUntil?: Date;
  scheduledEventId?: string;
};

export type NewAiJob = { userId: string; applicationId: string; status: AiJobStatus };

export type NewNote = { applicationId: string; body: string };

export type LoadedBoardRow = ApplicationRowInput & {
  currentStage: Stage;
  stack: string[];
  matchScore: number | null;
};

export type CompensatedEvent = { applicationId: string; compensatesEventId: string };

export type ResumeOwner = { userId: string; resumeId: string };

export const NEW_USER_SETTINGS_ROW = {
  silenceDays: 7,
  autoGhostDays: 30,
  askRejectionReason: true,
  monthlySummaryEnabled: true,
  theme: 'system',
  timezone: 'Europe/Kyiv',
  quietHoursStart: new Date('1970-01-01T22:00:00.000Z'),
  quietHoursEnd: new Date('1970-01-01T08:00:00.000Z'),
  notifyInApp: true,
  notifyPush: false,
  notifyEmail: true,
  analyticsOptOut: false,
  activeResumeVersionId: null,
} satisfies Omit<UserSettings, 'userId' | 'createdAt' | 'updatedAt'>;

export const NEW_USER_SETTINGS = {
  ...NEW_USER_SETTINGS_ROW,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

export const randomEmail = (): string => `${faker.string.uuid()}@example.test`;

export function seedRejectionReasons(prisma: PrismaService): Promise<number> {
  return new SeedRepository(prisma).upsertRejectionReasons(sharedRejectionReasons());
}

export function createUser(
  prisma: PrismaService,
  overrides: Partial<Prisma.UserCreateInput> = {},
): Promise<User> {
  return prisma.user.create({
    data: {
      email: randomEmail(),
      displayName: faker.person.fullName(),
      settings: { create: {} },
      ...overrides,
    },
  });
}

export async function createSearch(
  prisma: PrismaService,
  { userId, status = 'active' }: NewSearch,
): Promise<string> {
  const search = await prisma.search.create({
    data: { userId, status, title: faker.lorem.words(2) },
  });
  return search.id;
}

export async function createOwnedApplication(prisma: PrismaService): Promise<OwnedApplication> {
  const user = await createUser(prisma);
  const searchId = await createSearch(prisma, { userId: user.id });
  const application = await prisma.application.create({
    data: {
      userId: user.id,
      searchId,
      company: faker.company.name(),
      position: faker.person.jobTitle(),
      source: 'djinni',
    },
  });
  return { userId: user.id, searchId, applicationId: application.id };
}

export async function createApplicationRows(
  prisma: PrismaService,
  { userId, searchId, rows }: NewApplicationRows,
): Promise<string[]> {
  const created = await prisma.application.createManyAndReturn({
    data: rows.map((row) => ({
      company: faker.company.name(),
      position: faker.person.jobTitle(),
      source: faker.helpers.arrayElement(SOURCES),
      ...row,
      userId,
      searchId,
    })),
    select: { id: true },
  });
  return created.map(({ id }) => id);
}

export async function createScheduledEvent(
  prisma: PrismaService,
  { status = 'planned', ...event }: NewScheduledEvent,
): Promise<string> {
  const created = await prisma.scheduledEvent.create({ data: { ...event, status } });
  return created.id;
}

export async function createReminder(
  prisma: PrismaService,
  { type = 'followup', status = 'pending', ...reminder }: NewReminder,
): Promise<string> {
  const created = await prisma.reminder.create({ data: { ...reminder, type, status } });
  return created.id;
}

export async function createStageEvents(
  prisma: PrismaService,
  events: Prisma.StageEventCreateManyInput[],
): Promise<void> {
  await prisma.stageEvent.createMany({ data: events });
}

export async function createNotes(prisma: PrismaService, notes: NewNote[]): Promise<string[]> {
  const created = await prisma.note.createManyAndReturn({ data: notes, select: { id: true } });
  return created.map(({ id }) => id);
}

export async function createAiJob(prisma: PrismaService, job: NewAiJob): Promise<string> {
  const created = await prisma.aiJob.create({ data: { ...job, kind: 'parse_vacancy' } });
  return created.id;
}

const BOARD_STAGE_WEIGHTS: Record<Stage, number> = {
  applied: 3,
  screening: 2,
  tech_interview: 1,
  final: 1,
  offer: 1,
  rejected: 8,
  ghosted: 5,
  withdrawn: 1,
};

const BOARD_STAGE_CYCLE = STAGES.flatMap((stage) =>
  Array.from({ length: BOARD_STAGE_WEIGHTS[stage] }, () => stage),
);

const BOARD_STACK = ['TypeScript', 'NestJS', 'PostgreSQL', 'Redis', 'Docker', 'Kafka'];

export function loadedBoardRows(count: number): LoadedBoardRow[] {
  return Array.from({ length: count }, (_, index) => ({
    currentStage: BOARD_STAGE_CYCLE[index % BOARD_STAGE_CYCLE.length] ?? 'applied',
    lastEventAt: minutesBefore(index + 1),
    stack: BOARD_STACK.slice(0, index % (BOARD_STACK.length + 1)),
    matchScore: index % 4 === 0 ? null : 40 + (index % 60),
  }));
}

export async function createStageEvent(
  prisma: PrismaService,
  applicationId: string,
): Promise<string> {
  const event = await prisma.stageEvent.create({
    data: { applicationId, fromStage: 'applied', toStage: 'screening' },
  });
  return event.id;
}

export function compensationOf(
  compensated: CompensatedEvent,
): Prisma.StageEventUncheckedCreateInput {
  return { ...compensated, fromStage: 'screening', toStage: 'applied' };
}

export async function createResume(prisma: PrismaService, userId: string): Promise<string> {
  const resume = await prisma.resume.create({ data: { userId, title: 'Backend CV' } });
  return resume.id;
}

export function resumeVersionData(owner: ResumeOwner): Prisma.ResumeVersionUncheckedCreateInput {
  return {
    ...owner,
    storageKey: `resumes/${owner.resumeId}/v1.pdf`,
    filename: 'cv.pdf',
    mime: 'application/pdf',
    sizeBytes: 2048,
    title: 'v1',
  };
}

export async function createResumeVersion(prisma: PrismaService, userId: string): Promise<string> {
  const resumeId = await createResume(prisma, userId);
  const version = await prisma.resumeVersion.create({
    data: resumeVersionData({ userId, resumeId }),
  });
  return version.id;
}
