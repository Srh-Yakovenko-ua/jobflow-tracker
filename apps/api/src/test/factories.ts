import { fakerUK as faker } from '@faker-js/faker';

import type { Prisma, User } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

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
