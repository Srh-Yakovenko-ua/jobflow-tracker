import { fakerUK as faker } from '@faker-js/faker';

import type { Prisma, User, UserSettings } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

export type OwnedApplication = { userId: string; searchId: string; applicationId: string };

export type CompensatedEvent = { applicationId: string; compensatesEventId: string };

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

export function createUser(
  prisma: PrismaService,
  overrides: Partial<Prisma.UserCreateInput> = {},
): Promise<User> {
  return prisma.user.create({
    data: {
      email: `${faker.string.uuid()}@example.test`,
      displayName: faker.person.fullName(),
      settings: { create: {} },
      ...overrides,
    },
  });
}

export async function createOwnedApplication(prisma: PrismaService): Promise<OwnedApplication> {
  const user = await createUser(prisma);
  const search = await prisma.search.create({
    data: { userId: user.id, title: faker.lorem.words(2) },
  });
  const application = await prisma.application.create({
    data: {
      userId: user.id,
      searchId: search.id,
      company: faker.company.name(),
      position: faker.person.jobTitle(),
      source: 'djinni',
    },
  });
  return { userId: user.id, searchId: search.id, applicationId: application.id };
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
