import {
  type AuthUser,
  DEFAULT_SEARCH_TITLE,
  type OAuthProvider,
  type RegisterInput,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { conflict } from '../../common/app-error.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { userRegisteredEvent } from './auth.events.js';
import { OAUTH_PROVIDER_SPECS } from './oauth-profiles.js';

export type OAuthAccountKey = { provider: OAuthProvider; providerUserId: string };

export type NewOAuthLink = OAuthAccountKey & { userId: string };

export type NewUser = Omit<RegisterInput, 'password'> & {
  passwordHash: string | null;
  oauthAccount?: OAuthAccountKey;
};

export type UserCredentials = AuthUser & { passwordHash: string | null };

export type NewPassword = { userId: string; passwordHash: string | null };

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

async function conflictOnDuplicate<T>(write: Promise<T>, detail: string): Promise<T> {
  try {
    return await write;
  } catch (error) {
    throw isUniqueViolation(error) ? conflict(detail) : error;
  }
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  createUserWithDefaults({ oauthAccount, ...newUser }: NewUser): Promise<AuthUser> {
    const created = this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: newUser.email,
          passwordHash: newUser.passwordHash,
          displayName: newUser.displayName ?? null,
          settings: { create: {} },
          searches: { create: { title: DEFAULT_SEARCH_TITLE } },
          ...(oauthAccount && { oauthAccounts: { create: oauthAccount } }),
        },
        select: AUTH_USER_SELECT,
      });
      await tx.outboxEvent.create({ data: userRegisteredEvent({ userId: user.id }) });
      return user;
    });
    return conflictOnDuplicate(created, 'Email is already registered');
  }

  async findUserByOAuthAccount(account: OAuthAccountKey): Promise<AuthUser | null> {
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: account },
      select: { user: { select: AUTH_USER_SELECT } },
    });
    return linked?.user ?? null;
  }

  async linkOAuthAccount(
    link: NewOAuthLink,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const { label } = OAUTH_PROVIDER_SPECS[link.provider];
    await conflictOnDuplicate(
      client.oAuthAccount.create({ data: link, select: { id: true } }),
      `This account is already linked to another ${label} account`,
    );
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

  async replacePassword(
    { userId, passwordHash }: NewPassword,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true },
    });
  }
}
