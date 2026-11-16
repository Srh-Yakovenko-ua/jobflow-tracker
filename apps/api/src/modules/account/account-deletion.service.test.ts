import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { unauthorized, validation } from '../../common/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FileStorage } from '../../storage/file-storage.js';
import { STORAGE_DOWN_DETAIL } from '../../storage/s3-outcomes.js';
import { FAKE_TRANSACTION, FakePrisma } from '../../test/fake-prisma.js';
import {
  DownFileStorage,
  ExportsPurgeDownFileStorage,
  FakeFileStorage,
} from '../../test/file-storage.js';
import { BOHDAN_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { type AccountConfirmation, AuthService } from '../auth/index.js';
import { AccountRepository, type InAccountTransaction } from './account.repository.js';
import { AccountDeletionService } from './account-deletion.service.js';

const PASSWORD = 'olena-password-1';

const OLENA_KEYS = [
  `users/${OLENA_ID}/resumes/cv.pdf`,
  `users/${OLENA_ID}/exports/export.zip`,
  `pending/users/${OLENA_ID}/resumes/next.pdf`,
];

const BOHDAN_KEYS = [`users/${BOHDAN_ID}/resumes/cv.pdf`, `pending/users/${BOHDAN_ID}/x.pdf`];

class FakeConfirmingAuth {
  constructor(private readonly steps: unknown[][]) {}

  confirmAccount({ userId, password }: AccountConfirmation): Promise<void> {
    this.steps.push(['confirmAccount', userId]);
    if (userId !== OLENA_ID) {
      return Promise.reject(unauthorized());
    }
    return password === PASSWORD
      ? Promise.resolve()
      : Promise.reject(validation([{ path: 'password', message: 'Password is wrong' }]));
  }
}

class FakeDeletingRepository {
  constructor(private readonly steps: unknown[][]) {}

  lockUser(userId: string, { tx }: InAccountTransaction): Promise<void> {
    return this.step(['lockUser', userId, tx]);
  }

  deleteOutboxOf(userId: string, { tx }: InAccountTransaction): Promise<void> {
    return this.step(['deleteOutboxOf', userId, tx]);
  }

  deleteUser(userId: string, { tx }: InAccountTransaction): Promise<void> {
    return this.step(['deleteUser', userId, tx]);
  }

  private step(entry: unknown[]): Promise<void> {
    this.steps.push(entry);
    return Promise.resolve();
  }
}

class RecordingStorage extends FakeFileStorage {
  constructor(private readonly steps: unknown[][]) {
    super();
  }

  override deletePrefix(prefix: string): Promise<void> {
    this.steps.push(['deletePrefix', prefix]);
    return super.deletePrefix(prefix);
  }
}

async function deletionWith(storageOf: (steps: unknown[][]) => FakeFileStorage) {
  const steps: unknown[][] = [];
  const repository = new FakeDeletingRepository(steps);
  const storage = storageOf(steps);
  for (const key of [...OLENA_KEYS, ...BOHDAN_KEYS]) {
    storage.objects.set(key, { bytes: new Uint8Array([1]), mime: 'application/pdf' });
  }
  const moduleRef = await Test.createTestingModule({
    providers: [
      AccountDeletionService,
      { provide: AuthService, useValue: new FakeConfirmingAuth(steps) },
      { provide: AccountRepository, useValue: repository },
      { provide: FileStorage, useValue: storage },
      { provide: PrismaService, useValue: new FakePrisma() },
    ],
  }).compile();
  return { service: moduleRef.get(AccountDeletionService), steps, storage, repository };
}

describe('AccountDeletionService.delete', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('confirms the password, removes the files under both prefixes, then deletes the outbox rows and the user in one transaction', async () => {
    const { service, steps, storage } = await deletionWith(
      (recorded) => new RecordingStorage(recorded),
    );

    await service.delete(OLENA_ID, { password: PASSWORD });

    expect(steps).toEqual([
      ['confirmAccount', OLENA_ID],
      ['deletePrefix', `users/${OLENA_ID}/`],
      ['deletePrefix', `pending/users/${OLENA_ID}/`],
      ['lockUser', OLENA_ID, FAKE_TRANSACTION],
      ['deleteOutboxOf', OLENA_ID, FAKE_TRANSACTION],
      ['deleteUser', OLENA_ID, FAKE_TRANSACTION],
      ['deletePrefix', `users/${OLENA_ID}/exports/`],
    ]);
    expect([...storage.objects.keys()]).toEqual(BOHDAN_KEYS);
  });

  it('a zip written between the purge and the commit is removed', async () => {
    const { service, storage, repository } = await deletionWith(() => new FakeFileStorage());
    vi.spyOn(repository, 'lockUser').mockImplementationOnce(() =>
      storage.put({
        key: `users/${OLENA_ID}/exports/late.zip`,
        bytes: new Uint8Array([1]),
        mime: 'application/zip',
      }),
    );

    await service.delete(OLENA_ID, { password: PASSWORD });

    expect([...storage.objects.keys()]).toEqual(BOHDAN_KEYS);
  });

  it('refuses a wrong password with 422 on password and keeps the files and the user', async () => {
    const { service, steps, storage } = await deletionWith(() => new FakeFileStorage());

    await expect(service.delete(OLENA_ID, { password: 'wrong password' })).rejects.toMatchObject({
      body: { status: 422, errors: [{ path: 'password', message: 'Password is wrong' }] },
    });
    expect([steps.map(([step]) => step), storage.keysUnder(`users/${OLENA_ID}/`)]).toEqual([
      ['confirmAccount'],
      OLENA_KEYS.slice(0, 2),
    ]);
  });

  it('a deletion whose export purge fails after the commit resolves and logs', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, steps } = await deletionWith(() => new ExportsPurgeDownFileStorage());

    await expect(service.delete(OLENA_ID, { password: PASSWORD })).resolves.toBeUndefined();

    expect(steps.at(-1)).toEqual(['deleteUser', OLENA_ID, FAKE_TRANSACTION]);
    expect(warn.mock.calls).toEqual([
      [
        { userId: OLENA_ID, err: STORAGE_DOWN_DETAIL },
        'exports not purged after the account deletion',
      ],
    ]);
  });

  it('answers 503 when the file storage is down and keeps the user whole for a retry', async () => {
    const { service, steps } = await deletionWith(() => new DownFileStorage());

    await expect(service.delete(OLENA_ID, { password: PASSWORD })).rejects.toMatchObject({
      status: 503,
    });
    expect(steps.map(([step]) => step)).toEqual(['confirmAccount']);
  });
});
