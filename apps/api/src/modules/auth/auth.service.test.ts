import type { AuthUser } from '@jobflow/shared';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { conflict } from '../../common/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NEW_USER_SETTINGS_ROW } from '../../test/factories.js';
import { FAKE_TRANSACTION, FakePrisma } from '../../test/fake-prisma.js';
import {
  AuthRepository,
  type NewOAuthLink,
  type NewPassword,
  type NewUser,
  type OAuthAccountKey,
  type UserCredentials,
  type UserProfile,
} from './auth.repository.js';
import { AuthService, type OAuthIdentity } from './auth.service.js';
import { PasswordHasher } from './password-hasher.js';
import { type RevokeAllInput, SessionRepository } from './session.repository.js';

type InTransaction<T> = T & { client: unknown };

type StoredUser = UserCredentials & { oauthAccounts?: OAuthAccountKey[] };

const DUMMY_HASH = 'dummy-hash';

const NOW = new Date('2026-10-21T10:00:00.000Z');

const FAMILY_ID = '0199f0a0-0000-7000-8000-0000000000f1';

const ANNA: AuthUser = {
  id: '0199f0a0-0000-7000-8000-000000000001',
  email: 'anna@example.test',
  displayName: 'Анна',
  locale: 'uk',
};

class FakeSessionRepository {
  readonly revokedAll: InTransaction<RevokeAllInput>[] = [];

  revokeAll(input: RevokeAllInput, client: unknown): Promise<void> {
    this.revokedAll.push({ ...input, client });
    return Promise.resolve();
  }
}

class FakePasswordHasher {
  readonly verified: { digest: string; password: string }[] = [];

  readonly dummyHash = DUMMY_HASH;

  hash(password: string): Promise<string> {
    return Promise.resolve(`hashed:${password}`);
  }

  verify(digest: string, password: string): Promise<boolean> {
    this.verified.push({ digest, password });
    return Promise.resolve(digest === `hashed:${password}`);
  }
}

class FakeAuthRepository {
  readonly created: NewUser[] = [];
  readonly passwords: InTransaction<NewPassword>[] = [];
  readonly linked: InTransaction<NewOAuthLink>[] = [];

  constructor(
    private readonly users: StoredUser[] = [],
    private readonly profiles: UserProfile[] = [],
  ) {}

  findUserByOAuthAccount({ provider, providerUserId }: OAuthAccountKey): Promise<AuthUser | null> {
    const owner = this.users.find(({ oauthAccounts = [] }) =>
      oauthAccounts.some(
        (account) => account.provider === provider && account.providerUserId === providerUserId,
      ),
    );
    return Promise.resolve(owner ?? null);
  }

  linkOAuthAccount(link: NewOAuthLink, client?: unknown): Promise<void> {
    this.linked.push({ ...link, client });
    return Promise.resolve();
  }

  createUserWithDefaults(newUser: NewUser): Promise<AuthUser> {
    if (this.users.some((user) => user.email === newUser.email)) {
      return Promise.reject(conflict('Email is already registered'));
    }
    this.created.push(newUser);
    return Promise.resolve({ ...ANNA, email: newUser.email });
  }

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return Promise.resolve(this.users.find((user) => user.email === email) ?? null);
  }

  findCredentialsById(userId: string): Promise<UserCredentials | null> {
    return Promise.resolve(this.users.find((user) => user.id === userId) ?? null);
  }

  findProfile(userId: string): Promise<UserProfile | null> {
    return Promise.resolve(this.profiles.find((profile) => profile.id === userId) ?? null);
  }

  replacePassword(password: NewPassword, client: unknown): Promise<void> {
    this.passwords.push({ ...password, client });
    return Promise.resolve();
  }
}

async function authServiceWith(users: UserCredentials[] = [], profiles: UserProfile[] = []) {
  const repository = new FakeAuthRepository(users, profiles);
  const sessions = new FakeSessionRepository();
  const hasher = new FakePasswordHasher();
  const moduleRef = await Test.createTestingModule({
    providers: [AuthService, AuthRepository, SessionRepository, PasswordHasher, PrismaService],
  })
    .overrideProvider(AuthRepository)
    .useValue(repository)
    .overrideProvider(SessionRepository)
    .useValue(sessions)
    .overrideProvider(PasswordHasher)
    .useValue(hasher)
    .overrideProvider(PrismaService)
    .useValue(new FakePrisma())
    .compile();
  return { repository, sessions, hasher, service: moduleRef.get(AuthService) };
}

const INVALID_CREDENTIALS = {
  body: { status: 401, type: 'unauthorized', detail: 'Invalid email or password' },
};

const annaWithPassword = { ...ANNA, passwordHash: 'hashed:correct password' };

describe('AuthService.register', () => {
  it('stores the argon2 hash, never the password, and answers the new user', async () => {
    const { repository, service } = await authServiceWith();

    const user = await service.register({
      email: 'olena@example.test',
      password: 'long enough secret',
    });

    expect(repository.created).toEqual([
      { email: 'olena@example.test', passwordHash: 'hashed:long enough secret' },
    ]);
    expect(user).toEqual({ ...ANNA, email: 'olena@example.test' });
  });

  it('passes the 409 for an email that is already registered through', async () => {
    const { service } = await authServiceWith([{ ...ANNA, passwordHash: 'hashed:x' }]);

    const failure = service.register({ email: ANNA.email, password: 'long enough secret' });

    await expect(failure).rejects.toMatchObject({ body: { status: 409, type: 'conflict' } });
  });
});

describe('AuthService.login', () => {
  it('signs in with the right password and answers the user without its hash', async () => {
    const { service } = await authServiceWith([annaWithPassword]);

    const user = await service.login({ email: ANNA.email, password: 'correct password' });

    expect(user).toEqual(ANNA);
  });

  it('refuses a wrong password with the generic 401 after one verify of the stored hash', async () => {
    const { hasher, service } = await authServiceWith([annaWithPassword]);

    const failure = service.login({ email: ANNA.email, password: 'wrong password' });

    await expect(failure).rejects.toMatchObject(INVALID_CREDENTIALS);
    expect(hasher.verified).toEqual([
      { digest: 'hashed:correct password', password: 'wrong password' },
    ]);
  });

  it.each([
    ['an unknown email', []],
    ['an account without a password', [{ ...ANNA, passwordHash: null }]],
  ])(
    'refuses %s with the same 401 after one verify of the dummy hash',
    async (_case, users: UserCredentials[]) => {
      const { hasher, service } = await authServiceWith(users);

      const failure = service.login({ email: ANNA.email, password: 'some password' });

      await expect(failure).rejects.toMatchObject(INVALID_CREDENTIALS);
      expect(hasher.verified).toEqual([{ digest: DUMMY_HASH, password: 'some password' }]);
    },
  );
});

describe('AuthService.changePassword', () => {
  const input = { currentPassword: 'correct password', newPassword: 'a brand new secret' };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores the new hash and revokes every family but the current one in one transaction', async () => {
    const { repository, sessions, service } = await authServiceWith([annaWithPassword]);

    await service.changePassword({ userId: ANNA.id, input, keepFamilyId: FAMILY_ID });

    expect(repository.passwords).toEqual([
      { userId: ANNA.id, passwordHash: 'hashed:a brand new secret', client: FAKE_TRANSACTION },
    ]);
    expect(sessions.revokedAll).toEqual([
      { userId: ANNA.id, now: NOW, keepFamilyId: FAMILY_ID, client: FAKE_TRANSACTION },
    ]);
  });

  it.each<{ case: string; users: UserCredentials[]; currentPassword: string }>([
    {
      case: 'a wrong current password',
      users: [annaWithPassword],
      currentPassword: 'wrong password',
    },
    {
      case: 'an account without a password',
      users: [{ ...ANNA, passwordHash: null }],
      currentPassword: 'correct password',
    },
  ])(
    'refuses $case with 422 on currentPassword and keeps the old hash',
    async ({ users, currentPassword }) => {
      const { repository, sessions, service } = await authServiceWith(users);

      const failure = service.changePassword({
        userId: ANNA.id,
        input: { ...input, currentPassword },
        keepFamilyId: undefined,
      });

      await expect(failure).rejects.toMatchObject({
        body: {
          status: 422,
          type: 'validation_error',
          errors: [{ path: 'currentPassword', message: 'Current password is wrong' }],
        },
      });
      expect([repository.passwords, sessions.revokedAll]).toEqual([[], []]);
    },
  );
});

describe('AuthService.signInWithOAuth', () => {
  const GITHUB_ANNA: OAuthAccountKey = { provider: 'github', providerUserId: '1001' };

  const annaOnGitHub: OAuthIdentity = { ...GITHUB_ANNA, email: ANNA.email, displayName: 'Анна' };

  const bohdan: StoredUser = {
    id: '0199f0a0-0000-7000-8000-000000000002',
    email: 'bohdan@example.test',
    displayName: null,
    locale: 'uk',
    passwordHash: 'hashed:bohdan password',
    oauthAccounts: [{ provider: 'github', providerUserId: '1002' }],
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('signs into the user the GitHub account is linked to, never another user', async () => {
    const { repository, service } = await authServiceWith([
      bohdan,
      { ...ANNA, passwordHash: null, oauthAccounts: [GITHUB_ANNA] },
    ]);

    const user = await service.signInWithOAuth(annaOnGitHub);

    expect(user).toMatchObject(ANNA);
    expect([repository.created, repository.linked]).toEqual([[], []]);
  });

  it('links the GitHub account to the passwordless user with the same verified email and keeps its sessions', async () => {
    const { repository, sessions, service } = await authServiceWith([
      bohdan,
      { ...ANNA, passwordHash: null },
    ]);

    const user = await service.signInWithOAuth(annaOnGitHub);

    expect(user).toEqual(ANNA);
    expect(repository.linked).toEqual([{ userId: ANNA.id, ...GITHUB_ANNA }]);
    expect([repository.created, repository.passwords, sessions.revokedAll]).toEqual([[], [], []]);
  });

  it('links the GitHub account to the password user with the same verified email, drops the password and revokes every session in one transaction', async () => {
    const { repository, sessions, service } = await authServiceWith([bohdan, annaWithPassword]);

    const user = await service.signInWithOAuth(annaOnGitHub);

    expect(user).toEqual(ANNA);
    expect(repository.linked).toEqual([
      { userId: ANNA.id, ...GITHUB_ANNA, client: FAKE_TRANSACTION },
    ]);
    expect(repository.passwords).toEqual([
      { userId: ANNA.id, passwordHash: null, client: FAKE_TRANSACTION },
    ]);
    expect(sessions.revokedAll).toEqual([{ userId: ANNA.id, now: NOW, client: FAKE_TRANSACTION }]);
  });

  it('creates a user without a password for a new verified email', async () => {
    const { repository, service } = await authServiceWith([bohdan]);

    const user = await service.signInWithOAuth(annaOnGitHub);

    expect(user).toEqual(ANNA);
    expect(repository.created).toEqual([
      { email: ANNA.email, displayName: 'Анна', passwordHash: null, oauthAccount: GITHUB_ANNA },
    ]);
    expect(repository.linked).toEqual([]);
  });
});

describe('AuthService.me', () => {
  it('answers the user and their settings with quiet hours as HH:MM', async () => {
    const { service } = await authServiceWith([], [{ ...ANNA, settings: NEW_USER_SETTINGS_ROW }]);

    const me = await service.me(ANNA.id);

    expect(me).toEqual({
      user: ANNA,
      settings: { ...NEW_USER_SETTINGS_ROW, quietHoursStart: '22:00', quietHoursEnd: '08:00' },
    });
  });

  it.each([
    ['an unknown user', []],
    ['a user without settings', [{ ...ANNA, settings: null }]],
  ])('refuses %s with 401', async (_case, profiles: UserProfile[]) => {
    const { service } = await authServiceWith([], profiles);

    await expect(service.me(ANNA.id)).rejects.toMatchObject({
      body: { status: 401, type: 'unauthorized' },
    });
  });
});
