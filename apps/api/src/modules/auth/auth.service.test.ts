import type { AuthUser } from '@jobflow/shared';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { conflict } from '../../common/app-error.js';
import { AuthRepository, type NewUser, type UserCredentials } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.js';

const DUMMY_HASH = 'dummy-hash';

const ANNA: AuthUser = {
  id: '0199f0a0-0000-7000-8000-000000000001',
  email: 'anna@example.test',
  displayName: 'Анна',
  locale: 'uk',
};

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

  constructor(private readonly users: UserCredentials[] = []) {}

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
}

async function authServiceWith(users: UserCredentials[] = []) {
  const repository = new FakeAuthRepository(users);
  const hasher = new FakePasswordHasher();
  const moduleRef = await Test.createTestingModule({
    providers: [AuthService, AuthRepository, PasswordHasher],
  })
    .overrideProvider(AuthRepository)
    .useValue(repository)
    .overrideProvider(PasswordHasher)
    .useValue(hasher)
    .compile();
  return { repository, hasher, service: moduleRef.get(AuthService) };
}

const INVALID_CREDENTIALS = {
  body: { status: 401, type: 'unauthorized', detail: 'Invalid email or password' },
};

describe('AuthService.register', () => {
  it('stores the argon2 hash, never the password, and answers the new user', async () => {
    const { repository, service } = await authServiceWith();

    const response = await service.register({
      email: 'olena@example.test',
      password: 'long enough secret',
    });

    expect(repository.created).toEqual([
      { email: 'olena@example.test', passwordHash: 'hashed:long enough secret' },
    ]);
    expect(response).toEqual({ user: { ...ANNA, email: 'olena@example.test' } });
  });

  it('passes the 409 for an email that is already registered through', async () => {
    const { service } = await authServiceWith([{ ...ANNA, passwordHash: 'hashed:x' }]);

    const failure = service.register({ email: ANNA.email, password: 'long enough secret' });

    await expect(failure).rejects.toMatchObject({ body: { status: 409, type: 'conflict' } });
  });
});

describe('AuthService.login', () => {
  const annaWithPassword = { ...ANNA, passwordHash: 'hashed:correct password' };

  it('signs in with the right password and answers the user without its hash', async () => {
    const { service } = await authServiceWith([annaWithPassword]);

    const response = await service.login({ email: ANNA.email, password: 'correct password' });

    expect(response).toEqual({ user: ANNA });
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
