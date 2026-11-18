import type {
  AuthUser,
  ChangePasswordInput,
  DeleteAccountInput,
  LoginInput,
  MeResponse,
  RegisterInput,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { unauthorized, validation } from '../../common/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toUserSettings } from '../../prisma/user-settings-row.js';
import { AuthRepository, type OAuthAccountKey, type UserCredentials } from './auth.repository.js';
import type { OAuthProfile } from './oauth-profiles.js';
import { PasswordHasher } from './password-hasher.js';
import { UserTokens } from './user-tokens.service.js';

export type ChangePassword = {
  userId: string;
  input: ChangePasswordInput;
  keepFamilyId: string | undefined;
};

export type OAuthIdentity = OAuthAccountKey & OAuthProfile;

export type AccountConfirmation = DeleteAccountInput & { userId: string };

type EmailLink = { user: UserCredentials; oauthAccount: OAuthAccountKey };

const sameEmail = (given: string, email: string) =>
  given.trim().toLowerCase() === email.toLowerCase();

function toAuthUser({ id, email, displayName, locale }: AuthUser): AuthUser {
  return { id, email, displayName, locale };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly tokens: UserTokens,
    private readonly hasher: PasswordHasher,
    private readonly prisma: PrismaService,
  ) {}

  async register({ password, ...profile }: RegisterInput): Promise<AuthUser> {
    const passwordHash = await this.hasher.hash(password);
    return this.repository.createUserWithDefaults({ ...profile, passwordHash });
  }

  async login({ email, password }: LoginInput): Promise<AuthUser> {
    const credentials = await this.repository.findCredentialsByEmail(email);
    const user = await this.verified(credentials, password);
    if (user === undefined) {
      throw unauthorized('Invalid email or password');
    }
    return toAuthUser(user);
  }

  async changePassword({ userId, input, keepFamilyId }: ChangePassword): Promise<void> {
    const credentials = await this.repository.findCredentialsById(userId);
    if ((await this.verified(credentials, input.currentPassword)) === undefined) {
      throw validation([{ path: 'currentPassword', message: 'Current password is wrong' }]);
    }
    const passwordHash = await this.hasher.hash(input.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await this.repository.replacePassword({ userId, passwordHash }, tx);
      await this.tokens.revokeAll({ userId, keepFamilyId }, tx);
    });
  }

  async confirmAccount({ userId, password }: AccountConfirmation): Promise<void> {
    const credentials = await this.repository.findCredentialsById(userId);
    if (credentials === null) {
      throw unauthorized();
    }
    const confirmed =
      credentials.passwordHash === null
        ? sameEmail(password, credentials.email)
        : (await this.verified(credentials, password)) !== undefined;
    if (!confirmed) {
      throw validation([{ path: 'password', message: 'Password is wrong' }]);
    }
  }

  async signInWithOAuth({
    provider,
    providerUserId,
    email,
    displayName,
  }: OAuthIdentity): Promise<AuthUser> {
    const oauthAccount = { provider, providerUserId };
    const linked = await this.repository.findUserByOAuthAccount(oauthAccount);
    if (linked !== null) {
      return linked;
    }
    const emailOwner = await this.repository.findCredentialsByEmail(email);
    if (emailOwner === null) {
      return this.repository.createUserWithDefaults({
        email,
        displayName,
        passwordHash: null,
        oauthAccount,
      });
    }
    await this.linkByVerifiedEmail({ user: emailOwner, oauthAccount });
    return toAuthUser(emailOwner);
  }

  async me(userId: string): Promise<MeResponse> {
    const profile = await this.repository.findProfile(userId);
    if (profile?.settings == null) {
      throw unauthorized();
    }
    return {
      user: toAuthUser(profile),
      settings: toUserSettings(profile.settings),
      unreadNotifications: profile._count.notifications,
    };
  }

  private async verified(
    credentials: UserCredentials | null,
    password: string,
  ): Promise<UserCredentials | undefined> {
    const digest = credentials?.passwordHash ?? this.hasher.dummyHash;
    const matches = await this.hasher.verify(digest, password);
    return credentials?.passwordHash != null && matches ? credentials : undefined;
  }

  private async linkByVerifiedEmail({ user, oauthAccount }: EmailLink): Promise<void> {
    const userId = user.id;
    if (user.passwordHash === null) {
      await this.repository.linkOAuthAccount({ userId, ...oauthAccount });
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      await this.repository.linkOAuthAccount({ userId, ...oauthAccount }, tx);
      await this.repository.replacePassword({ userId, passwordHash: null }, tx);
      await this.tokens.revokeAll({ userId }, tx);
    });
  }
}
