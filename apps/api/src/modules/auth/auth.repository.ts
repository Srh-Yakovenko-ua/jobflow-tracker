import { type AuthUser, DEFAULT_SEARCH_TITLE, type RegisterInput } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { conflict } from '../../common/app-error.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { userRegisteredEvent } from './auth.events.js';

export type NewUser = Omit<RegisterInput, 'password'> & { passwordHash: string };

export type UserCredentials = AuthUser & { passwordHash: string | null };

export type NewPassword = {
  userId: string;
  passwordHash: string;
  keepFamilyId: string | undefined;
  now: Date;
};

const AUTH_USER_SELECT = { id: true, email: true, displayName: true, locale: true } as const;

const CREDENTIALS_SELECT = { ...AUTH_USER_SELECT, passwordHash: true } as const;

const SETTINGS_SELECT = {
  silenceDays: true,
  autoGhostDays: true,
  askRejectionReason: true,
  monthlySummaryEnabled: true,
  theme: true,
  timezone: true,
  quietHoursStart: true,
  quietHoursEnd: true,
  notifyInApp: true,
  notifyPush: true,
  notifyEmail: true,
  analyticsOptOut: true,
  activeResumeVersionId: true,
} as const satisfies Prisma.UserSettingsSelect;

export type SettingsRow = Prisma.UserSettingsGetPayload<{ select: typeof SETTINGS_SELECT }>;

export type UserProfile = AuthUser & { settings: SettingsRow | null };

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createUserWithDefaults(newUser: NewUser): Promise<AuthUser> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: newUser.email,
            passwordHash: newUser.passwordHash,
            displayName: newUser.displayName ?? null,
            settings: { create: {} },
            searches: { create: { title: DEFAULT_SEARCH_TITLE } },
          },
          select: AUTH_USER_SELECT,
        });
        await tx.outboxEvent.create({ data: userRegisteredEvent({ userId: user.id }) });
        return user;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict('Email is already registered');
      }
      throw error;
    }
  }

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: CREDENTIALS_SELECT,
    });
  }

  findCredentialsById(userId: string): Promise<UserCredentials | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: CREDENTIALS_SELECT,
    });
  }

  findProfile(userId: string): Promise<UserProfile | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...AUTH_USER_SELECT, settings: { select: SETTINGS_SELECT } },
    });
  }

  async replacePassword({ userId, passwordHash, keepFamilyId, now }: NewPassword): Promise<void> {
    const otherFamilies = keepFamilyId === undefined ? {} : { familyId: { not: keepFamilyId } };
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
        select: { id: true },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null, ...otherFamilies },
        data: { revokedAt: now },
      }),
    ]);
  }
}
