import { PUSH_LIMITS } from '@jobflow/shared';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { NEW_USER_SETTINGS } from '../../test/factories.js';
import { CHROME_SUBSCRIPTION, ScriptedPushSender, SILENCE_PUSH } from '../../test/push.js';
import { OLENA_ID } from '../../test/service-fixtures.js';
import { fixedClock, NOW } from '../../test/time.js';
import { SettingsService } from '../settings/index.js';
import { PushRepository, type PushTargetRow } from './push.repository.js';
import { PushSendService } from './push-send.service.js';
import { PushSender } from './push-sender.js';

const CHROME_ROW: PushTargetRow = {
  id: '0199f0a0-0000-7000-8000-000000000401',
  endpoint: CHROME_SUBSCRIPTION.endpoint,
  ...CHROME_SUBSCRIPTION.keys,
};

const PHONE_ROW: PushTargetRow = {
  ...CHROME_ROW,
  id: '0199f0a0-0000-7000-8000-000000000402',
  endpoint: 'https://fcm.googleapis.com/fcm/send/olena-phone',
};

const JOB = { userId: OLENA_ID, message: SILENCE_PUSH };

class FakePushTargets {
  readonly calls: string[] = [];

  readonly unsaved = new Set<string>();

  readonly deleted = new Set<string>();

  listForUser(userId: string): Promise<PushTargetRow[]> {
    this.calls.push('listForUser');
    return Promise.resolve(userId === OLENA_ID ? [CHROME_ROW, PHONE_ROW] : []);
  }

  markDelivered(_userId: string, { id }: { id: string }): Promise<void> {
    this.calls.push(`markDelivered ${id}`);
    return this.unsaved.has(id) ? Promise.reject(new Error('write lost')) : Promise.resolve();
  }

  readonly failedCounts = new Map<string, number>();

  recordFailure(_userId: string, id: string): Promise<number | null> {
    this.calls.push(`recordFailure ${id}`);
    if (this.deleted.has(id)) {
      return Promise.resolve(null);
    }
    const failedCount = (this.failedCounts.get(id) ?? 0) + 1;
    this.failedCounts.set(id, failedCount);
    return Promise.resolve(failedCount);
  }

  remove(_userId: string, id: string): Promise<number> {
    this.calls.push(`remove ${id}`);
    return Promise.resolve(1);
  }
}

type FailedChrome = { failedCount: number; deleted?: boolean };

async function failedSendWith({ failedCount, deleted = false }: FailedChrome) {
  const sender = new ScriptedPushSender();
  sender.answer = 'failed';
  const setup = await sendWith({ sender });
  setup.repository.failedCounts.set(CHROME_ROW.id, failedCount);
  if (deleted) {
    setup.repository.deleted.add(CHROME_ROW.id);
  }
  await expect(setup.service.send(JOB)).resolves.toEqual(['failed', 'failed']);
  return setup.repository;
}

type SendSetup = { notifyPush?: boolean; sender?: ScriptedPushSender };

async function sendWith({ notifyPush = true, sender = new ScriptedPushSender() }: SendSetup = {}) {
  const repository = new FakePushTargets();
  const settings = { get: () => Promise.resolve({ ...NEW_USER_SETTINGS, notifyPush }) };
  const moduleRef = await Test.createTestingModule({
    providers: [
      PushSendService,
      { provide: PushRepository, useValue: repository },
      { provide: PushSender, useValue: sender },
      { provide: SettingsService, useValue: settings },
      { provide: Clock, useValue: fixedClock(NOW) },
    ],
  }).compile();
  return { repository, sender, service: moduleRef.get(PushSendService) };
}

describe('PushSendService.send', () => {
  it('a retry after one failed write pushes nobody twice', async () => {
    const { repository, sender, service } = await sendWith();
    repository.unsaved.add(CHROME_ROW.id);

    await expect(service.send(JOB)).resolves.toEqual(['sent', 'sent']);

    expect(sender.sent.map(({ target }) => target.endpoint)).toEqual([
      CHROME_ROW.endpoint,
      PHONE_ROW.endpoint,
    ]);
    expect(repository.calls).toContain(`markDelivered ${PHONE_ROW.id}`);
  });

  it('a held push is not sent once notifyPush is off', async () => {
    const { sender, service } = await sendWith({ notifyPush: false });

    await expect(service.send(JOB)).resolves.toEqual([]);

    expect(sender.sent).toEqual([]);
  });

  it('a send without VAPID keys leaves failed_count alone', async () => {
    const sender = new ScriptedPushSender();
    sender.enabled = false;
    sender.answer = 'failed';
    const { repository, service } = await sendWith({ sender });

    await expect(service.send(JOB)).resolves.toEqual([]);

    expect([repository.calls, sender.sent]).toEqual([[], []]);
  });

  it('a subscription one failure short of the limit is kept', async () => {
    const repository = await failedSendWith({ failedCount: PUSH_LIMITS.failedSendsMax - 2 });

    expect(repository.calls).toEqual([
      'listForUser',
      `recordFailure ${CHROME_ROW.id}`,
      `recordFailure ${PHONE_ROW.id}`,
    ]);
  });

  it('a subscription reaching the limit is removed', async () => {
    const repository = await failedSendWith({ failedCount: PUSH_LIMITS.failedSendsMax - 1 });

    expect(repository.calls).toEqual([
      'listForUser',
      `recordFailure ${CHROME_ROW.id}`,
      `recordFailure ${PHONE_ROW.id}`,
      `remove ${CHROME_ROW.id}`,
    ]);
  });

  it('a subscription deleted mid-send is not removed', async () => {
    const repository = await failedSendWith({
      failedCount: PUSH_LIMITS.failedSendsMax - 1,
      deleted: true,
    });

    expect(repository.calls).toEqual([
      'listForUser',
      `recordFailure ${CHROME_ROW.id}`,
      `recordFailure ${PHONE_ROW.id}`,
    ]);
  });
});
