import type {
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  MeResponse,
  RegisterInput,
  UserSettings,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { unauthorized, validation } from '../../common/app-error.js';
import { AuthRepository, type SettingsRow, type UserCredentials } from './auth.repository.js';
import { PasswordHasher } from './password-hasher.js';

export type ChangePassword = {
  userId: string;
  input: ChangePasswordInput;
  keepFamilyId: string | undefined;
};

function toAuthUser({ id, email, displayName, locale }: AuthUser): AuthUser {
  return { id, email, displayName, locale };
}

const clockTime = (time: Date) => time.toISOString().slice(11, 16);

function toUserSettings({
  quietHoursStart,
  quietHoursEnd,
  ...settings
}: SettingsRow): UserSettings {
  return {
    ...settings,
    quietHoursStart: clockTime(quietHoursStart),
    quietHoursEnd: clockTime(quietHoursEnd),
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly hasher: PasswordHasher,
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
    await this.repository.replacePassword({ userId, passwordHash, keepFamilyId, now: new Date() });
  }

  async me(userId: string): Promise<MeResponse> {
    const profile = await this.repository.findProfile(userId);
    if (profile?.settings == null) {
      throw unauthorized();
    }
    return { user: toAuthUser(profile), settings: toUserSettings(profile.settings) };
  }

  private async verified(
    credentials: UserCredentials | null,
    password: string,
  ): Promise<UserCredentials | undefined> {
    const digest = credentials?.passwordHash ?? this.hasher.dummyHash;
    const matches = await this.hasher.verify(digest, password);
    return credentials?.passwordHash != null && matches ? credentials : undefined;
  }
}
