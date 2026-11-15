import { describe, expect, it } from 'vitest';

import { FileStorage } from '../../storage/file-storage.js';
import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import { FAKE_STORAGE_URL, FakeFileStorage } from '../../test/file-storage.js';
import { BOHDAN_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';
import {
  AccountRepository,
  type InAccountTransaction,
  type RecordExportRequested,
} from './account.repository.js';
import { AccountService } from './account.service.js';

const EXPORT_ID = '0199f0a0-0000-7000-8000-000000000401';

const NEWER_EXPORT_ID = '0199f0a0-0000-7000-8000-000000000402';

const REQUEST_ID = 'req-export-1';

const ZIP = { bytes: new Uint8Array([80, 75, 3, 4]), mime: 'application/zip' };

const olenaExportKey = `users/${OLENA_ID}/exports/${EXPORT_ID}.zip`;

class FakeAccountRepository {
  readonly steps: unknown[][] = [];

  users = new Set([OLENA_ID, BOHDAN_ID]);

  lockUser(userId: string, { tx }: InAccountTransaction): Promise<void> {
    this.steps.push(['lockUser', userId, tx]);
    return Promise.resolve();
  }

  exists(userId: string, { tx }: InAccountTransaction): Promise<boolean> {
    this.steps.push(['exists', userId, tx]);
    return Promise.resolve(this.users.has(userId));
  }

  recordExportRequested(userId: string, { requested, tx }: RecordExportRequested): Promise<void> {
    this.steps.push(['recordExportRequested', userId, requested, tx]);
    return Promise.resolve();
  }

  latestExports = new Map<string, string>();

  latestExportId(userId: string): Promise<string | null> {
    return Promise.resolve(this.latestExports.get(userId) ?? null);
  }
}

async function accountService() {
  const repository = new FakeAccountRepository();
  const storage = new FakeFileStorage();
  const moduleRef = await fakeTransactionModule({
    providers: [
      AccountService,
      { provide: AccountRepository, useValue: repository },
      { provide: FileStorage, useValue: storage },
    ],
    now: NOW,
  }).compile();
  return { service: moduleRef.get(AccountService), repository, storage };
}

describe('AccountService.requestExport', () => {
  it('locks the user and records export.requested with the format and the request id in one transaction', async () => {
    const { service, repository } = await accountService();

    const { exportId } = await service.requestExport(OLENA_ID, {
      format: 'csv',
      requestId: REQUEST_ID,
    });

    expect(repository.steps).toEqual([
      ['lockUser', OLENA_ID, FAKE_TRANSACTION],
      ['exists', OLENA_ID, FAKE_TRANSACTION],
      [
        'recordExportRequested',
        OLENA_ID,
        { exportId, format: 'csv', requestId: REQUEST_ID },
        FAKE_TRANSACTION,
      ],
    ]);
  });

  it('answers 404 to an account deleted since its token was signed and records nothing', async () => {
    const { service, repository } = await accountService();
    repository.users.delete(OLENA_ID);

    await expect(
      service.requestExport(OLENA_ID, { format: 'json', requestId: REQUEST_ID }),
    ).rejects.toMatchObject({ status: 404 });
    expect(repository.steps.map(([step]) => step)).toEqual(['lockUser', 'exists']);
  });
});

describe('AccountService.exportLink', () => {
  it('signs a link valid one hour to the built zip, named by the day it is signed', async () => {
    const { service, storage } = await accountService();
    await storage.put({ key: olenaExportKey, ...ZIP });

    const link = await service.exportLink(OLENA_ID, EXPORT_ID);

    expect(link).toEqual({
      status: 'ready',
      url: `${FAKE_STORAGE_URL}${olenaExportKey}`,
      expiresAt: '2026-10-22T10:00:00.000Z',
    });
    expect(storage.downloads).toEqual([
      {
        key: olenaExportKey,
        mime: 'application/zip',
        filename: 'jobflow-export-2026-10-22.zip',
        signedAt: NOW,
        ttlSeconds: 3600,
      },
    ]);
  });

  it('answers pending to the latest export before its zip is built and signs nothing', async () => {
    const { service, repository, storage } = await accountService();
    repository.latestExports.set(OLENA_ID, EXPORT_ID);

    expect(await service.exportLink(OLENA_ID, EXPORT_ID)).toEqual({ status: 'pending' });
    expect(storage.downloads).toEqual([]);
  });

  it('answers 404 to an export without a zip that a newer export replaced', async () => {
    const { service, repository } = await accountService();
    repository.latestExports.set(OLENA_ID, NEWER_EXPORT_ID);

    await expect(service.exportLink(OLENA_ID, EXPORT_ID)).rejects.toMatchObject({ status: 404 });
  });

  it('answers 404 to an export id never requested', async () => {
    const { service } = await accountService();

    await expect(service.exportLink(OLENA_ID, EXPORT_ID)).rejects.toMatchObject({ status: 404 });
  });

  it("answers 404 to another user's export id", async () => {
    const { service, storage } = await accountService();
    await storage.put({ key: olenaExportKey, ...ZIP });

    await expect(service.exportLink(BOHDAN_ID, EXPORT_ID)).rejects.toMatchObject({ status: 404 });
  });
});
