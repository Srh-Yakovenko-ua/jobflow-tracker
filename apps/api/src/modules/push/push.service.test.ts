import { PUSH_LIMITS } from '@jobflow/shared';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { CHROME_SUBSCRIPTION, ScriptedPushSender } from '../../test/push.js';
import { type ByUser } from '../../test/recorded-events.js';
import { BOHDAN_ID, MISSING_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { PushRepository, type SavePushSubscription } from './push.repository.js';
import { PushService } from './push.service.js';
import { PushSender } from './push-sender.js';

const SUBSCRIPTION_ID = '0199f0a0-0000-7000-8000-000000000401';

const PUSH_SUBSCRIPTION_NOT_FOUND = {
  body: { status: 404, type: 'not_found', detail: 'Push subscription not found' },
};

class FakePushRepository {
  readonly saved: ByUser<SavePushSubscription>[] = [];

  readonly owners = new Map<string, string>([[SUBSCRIPTION_ID, OLENA_ID]]);

  upsert(userId: string, subscription: SavePushSubscription): Promise<string> {
    this.saved.push({ userId, ...subscription });
    return Promise.resolve(SUBSCRIPTION_ID);
  }

  keepLatest(): Promise<void> {
    return Promise.resolve();
  }

  remove(userId: string, id: string): Promise<number> {
    if (this.owners.get(id) !== userId) return Promise.resolve(0);
    this.owners.delete(id);
    return Promise.resolve(1);
  }
}

async function serviceWith(sender = new ScriptedPushSender()) {
  const repository = new FakePushRepository();
  const moduleRef = await Test.createTestingModule({
    providers: [
      PushService,
      { provide: PushRepository, useValue: repository },
      { provide: PushSender, useValue: sender },
    ],
  }).compile();
  return { repository, service: moduleRef.get(PushService) };
}

describe('PushService.publicKey', () => {
  it.each([
    { publicKey: 'BPublicKey', case: 'with VAPID keys' },
    { publicKey: null, case: 'with push off' },
  ])('answers the public key $case', async ({ publicKey }) => {
    const sender = new ScriptedPushSender();
    sender.publicKey = publicKey;
    const { service } = await serviceWith(sender);

    expect(service.publicKey()).toEqual({ publicKey });
  });
});

describe('PushService.subscribe', () => {
  it('saves the endpoint and keys for the user with the user agent cut to its limit', async () => {
    const { repository, service } = await serviceWith();
    const userAgent = 'Mozilla/5.0 '.repeat(30);

    await expect(
      service.subscribe(OLENA_ID, { input: CHROME_SUBSCRIPTION, userAgent }),
    ).resolves.toEqual({ id: SUBSCRIPTION_ID });

    expect(repository.saved).toEqual([
      {
        userId: OLENA_ID,
        ...CHROME_SUBSCRIPTION,
        userAgent: userAgent.slice(0, PUSH_LIMITS.userAgentMax),
      },
    ]);
    expect(repository.saved[0]?.userAgent).toHaveLength(256);
  });

  it('saves no user agent when the browser sends none', async () => {
    const { repository, service } = await serviceWith();

    await service.subscribe(OLENA_ID, { input: CHROME_SUBSCRIPTION, userAgent: undefined });

    expect(repository.saved[0]?.userAgent).toBeNull();
  });
});

describe('PushService.remove', () => {
  it("removes the user's subscription", async () => {
    const { repository, service } = await serviceWith();

    await service.remove(OLENA_ID, SUBSCRIPTION_ID);

    expect(repository.owners.size).toBe(0);
  });

  it.each([
    { case: "another user's subscription", userId: BOHDAN_ID, id: SUBSCRIPTION_ID },
    { case: 'an unknown id', userId: OLENA_ID, id: MISSING_ID },
  ])('answers $case with 404 and keeps it', async ({ userId, id }) => {
    const { repository, service } = await serviceWith();

    await expect(service.remove(userId, id)).rejects.toMatchObject(PUSH_SUBSCRIPTION_NOT_FOUND);

    expect(repository.owners.get(SUBSCRIPTION_ID)).toBe(OLENA_ID);
  });
});
