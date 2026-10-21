import { refreshTokenSchema } from '@jobflow/shared';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { AccessTokens } from './access-tokens.js';
import { hashRefreshToken } from './refresh-tokens.js';
import {
  type NewRefreshToken,
  type OwnedToken,
  type RotateInput,
  type RotateOutcome,
  SessionRepository,
  type UserAt,
} from './session.repository.js';
import { SessionService } from './session.service.js';

const USER_ID = '0199f0a0-0000-7000-8000-000000000001';
const FAMILY_ID = '0199f0a0-0000-7000-8000-0000000000f1';
const NOW = new Date('2026-10-21T10:00:00.000Z');
const IN_30_DAYS = new Date('2026-11-20T10:00:00.000Z');

const INVALID_REFRESH = {
  body: { status: 401, type: 'unauthorized', detail: 'Invalid refresh token' },
};

class FakeSessionRepository {
  readonly inserted: NewRefreshToken[] = [];
  readonly rotations: RotateInput[] = [];
  readonly familyRevokes: string[] = [];
  readonly revokedAll: UserAt[] = [];
  readonly families = new Map<string, string>();
  outcome: RotateOutcome = { status: 'invalid' };

  insert(token: NewRefreshToken): Promise<void> {
    this.inserted.push(token);
    return Promise.resolve();
  }

  rotate(input: RotateInput): Promise<RotateOutcome> {
    this.rotations.push(input);
    return Promise.resolve(this.outcome);
  }

  revokeFamilyOf(tokenHash: string): Promise<void> {
    this.familyRevokes.push(tokenHash);
    return Promise.resolve();
  }

  revokeAll(input: UserAt): Promise<void> {
    this.revokedAll.push(input);
    return Promise.resolve();
  }

  familyOf({ tokenHash }: OwnedToken): Promise<string | undefined> {
    return Promise.resolve(this.families.get(tokenHash));
  }
}

class FakeAccessTokens {
  sign(userId: string): Promise<string> {
    return Promise.resolve(`access-for:${userId}`);
  }
}

async function sessionServiceWith() {
  const repository = new FakeSessionRepository();
  const moduleRef = await Test.createTestingModule({
    providers: [SessionService, SessionRepository, AccessTokens],
  })
    .overrideProvider(SessionRepository)
    .useValue(repository)
    .overrideProvider(AccessTokens)
    .useValue(new FakeAccessTokens())
    .compile();
  return { repository, service: moduleRef.get(SessionService) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SessionService.start', () => {
  it('opens a new family with a 30-day refresh token stored only as its hash', async () => {
    const { repository, service } = await sessionServiceWith();

    const session = await service.start(USER_ID);

    expect(session.accessToken).toBe(`access-for:${USER_ID}`);
    expect(session.refreshToken).toEqual(expect.schemaMatching(refreshTokenSchema));
    expect(repository.inserted).toMatchObject([
      { userId: USER_ID, tokenHash: hashRefreshToken(session.refreshToken), expiresAt: IN_30_DAYS },
    ]);
    expect(repository.inserted[0]?.familyId).toEqual(expect.schemaMatching(z.uuid()));
  });

  it('gives each sign-in its own family', async () => {
    const { repository, service } = await sessionServiceWith();

    await service.start(USER_ID);
    await service.start(USER_ID);

    const [first, second] = repository.inserted.map((token) => token.familyId);
    expect(first).not.toBe(second);
  });
});

describe('SessionService.refresh', () => {
  it('rotates the presented token into a new 30-day one and signs a new access token', async () => {
    const { repository, service } = await sessionServiceWith();
    repository.outcome = { status: 'rotated', userId: USER_ID };

    const session = await service.refresh('presented-refresh-token');

    expect(session.accessToken).toBe(`access-for:${USER_ID}`);
    expect(session.refreshToken).toEqual(expect.schemaMatching(refreshTokenSchema));
    expect(repository.rotations).toEqual([
      {
        tokenHash: hashRefreshToken('presented-refresh-token'),
        next: { tokenHash: hashRefreshToken(session.refreshToken), expiresAt: IN_30_DAYS },
        now: NOW,
      },
    ]);
  });

  it.each([
    [
      'a reused token whose family was revoked',
      { status: 'reused', userId: USER_ID, familyId: FAMILY_ID },
    ],
    ['an unknown or expired token', { status: 'invalid' }],
  ] satisfies [string, RotateOutcome][])('refuses %s with 401', async (_case, outcome) => {
    const { repository, service } = await sessionServiceWith();
    repository.outcome = outcome;

    await expect(service.refresh('presented-refresh-token')).rejects.toMatchObject(INVALID_REFRESH);
  });

  it('refuses a request without a refresh token before touching the store', async () => {
    const { repository, service } = await sessionServiceWith();

    await expect(service.refresh(undefined)).rejects.toMatchObject(INVALID_REFRESH);
    expect(repository.rotations).toEqual([]);
  });
});

describe('SessionService.logout', () => {
  it('revokes the family of the presented token', async () => {
    const { repository, service } = await sessionServiceWith();

    await service.logout('presented-refresh-token');

    expect(repository.familyRevokes).toEqual([hashRefreshToken('presented-refresh-token')]);
  });

  it('does nothing without a refresh token', async () => {
    const { repository, service } = await sessionServiceWith();

    await service.logout(undefined);

    expect(repository.familyRevokes).toEqual([]);
  });

  it('revokes every family of the user on logout everywhere', async () => {
    const { repository, service } = await sessionServiceWith();

    await service.logoutAll(USER_ID);

    expect(repository.revokedAll).toEqual([{ userId: USER_ID, now: NOW }]);
  });
});

describe('SessionService.familyOf', () => {
  it('finds the family of the presented token and none without one', async () => {
    const { repository, service } = await sessionServiceWith();
    repository.families.set(hashRefreshToken('presented-refresh-token'), FAMILY_ID);

    const found = await service.familyOf({
      userId: USER_ID,
      refreshToken: 'presented-refresh-token',
    });
    const absent = await service.familyOf({ userId: USER_ID, refreshToken: undefined });

    expect([found, absent]).toEqual([FAMILY_ID, undefined]);
  });
});
