import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { FileStorage, type PutObject } from '../../storage/file-storage.js';
import { storageDown } from '../../storage/s3-outcomes.js';
import { zipFilesOf } from '../../test/account.js';
import { DownFileStorage, FakeFileStorage } from '../../test/file-storage.js';
import { RecordingNotifications } from '../../test/notifications.js';
import { APPLICATION_ID, BOHDAN_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { NotificationsService } from '../notifications/index.js';
import type { ExportRequestedPayload } from './account.events.js';
import {
  AccountExportRepository,
  type ExportApplicationRow,
  type ExportData,
} from './account-export.repository.js';
import { AccountExportService } from './account-export.service.js';

const EXPORT_ID = '0199f0a0-0000-7000-8000-000000000401';

const OLDER_EXPORT_ID = '0199f0a0-0000-7000-8000-000000000400';

const at = (day: string) => new Date(`2026-10-${day}T09:00:00.000Z`);

const REJECTED_APPLICATION: ExportApplicationRow = {
  id: APPLICATION_ID,
  company: 'Ромашка',
  position: 'Frontend Engineer',
  source: 'djinni',
  url: 'https://djinni.co/jobs/42',
  salaryMin: 1500,
  salaryMax: 2500,
  currency: 'USD',
  stack: ['React', 'TypeScript'],
  location: 'Київ',
  workMode: 'remote',
  currentStage: 'rejected',
  matchScore: 72,
  appliedAt: at('01'),
  createdAt: at('01'),
  search: { title: 'Пошук 2026' },
  stageEvents: [
    {
      fromStage: null,
      toStage: 'applied',
      reasonCode: null,
      comment: null,
      occurredAt: at('01'),
      reason: null,
    },
    {
      fromStage: 'applied',
      toStage: 'screening',
      reasonCode: null,
      comment: null,
      occurredAt: at('03'),
      reason: null,
    },
    {
      fromStage: 'screening',
      toStage: 'rejected',
      reasonCode: 'skills_gap',
      comment: 'Мало досвіду з Next',
      occurredAt: at('05'),
      reason: { labelUk: 'Не вистачає скілів' },
    },
  ],
  contacts: [
    {
      name: 'Ірина',
      role: 'HR',
      email: 'iryna@romashka.test',
      telegram: null,
      phone: null,
      note: null,
    },
  ],
  notes: [{ body: 'Тестове на 3 дні', createdAt: at('02') }],
};

const OLENA_DATA: ExportData = { applications: [REJECTED_APPLICATION], resumeVersions: [] };

const requested = (format: ExportRequestedPayload['format']): ExportRequestedPayload => ({
  userId: OLENA_ID,
  exportId: EXPORT_ID,
  format,
  requestId: 'req-export-1',
});

const keyOf = (userId: string, exportId: string) => `users/${userId}/exports/${exportId}.zip`;

class FakeAccountExportRepository {
  readonly data = new Map<string, ExportData>([[OLENA_ID, OLENA_DATA]]);

  findExportData(userId: string): Promise<ExportData | null> {
    return Promise.resolve(this.data.get(userId) ?? null);
  }

  accountExists(userId: string): Promise<boolean> {
    return Promise.resolve(this.data.has(userId));
  }
}

class DeletedDuringPutStorage extends FakeFileStorage {
  constructor(private readonly deleteAccount: () => void) {
    super();
  }

  override async put(object: PutObject): Promise<void> {
    this.deleteAccount();
    await super.put(object);
  }
}

class DeleteFailsOnceStorage extends DeletedDuringPutStorage {
  private failed = false;

  override delete(key: string): Promise<void> {
    if (this.failed) {
      return super.delete(key);
    }
    this.failed = true;
    return Promise.reject(storageDown(new Error('connect ECONNREFUSED')));
  }
}

type ExportFakes = { storage?: FakeFileStorage; repository?: FakeAccountExportRepository };

async function exportService({
  storage = new FakeFileStorage(),
  repository = new FakeAccountExportRepository(),
}: ExportFakes = {}) {
  const notifications = new RecordingNotifications();
  const moduleRef = await Test.createTestingModule({
    providers: [
      AccountExportService,
      { provide: AccountExportRepository, useValue: repository },
      { provide: FileStorage, useValue: storage },
      { provide: NotificationsService, useValue: notifications },
    ],
  }).compile();
  return { service: moduleRef.get(AccountExportService), repository, storage, notifications };
}

function zipFilesAt(storage: FakeFileStorage, key: string): Record<string, string> {
  const zip = storage.objects.get(key);
  if (zip === undefined) throw new Error(`no zip at ${key}`);
  return zipFilesOf(zip.bytes);
}

describe('AccountExportService.build', () => {
  it('stores a zip of five csv files under the user exports with the template columns first and the history', async () => {
    const { service, storage } = await exportService();

    await service.build(requested('csv'));

    const files = zipFilesAt(storage, keyOf(OLENA_ID, EXPORT_ID));
    expect(Object.keys(files)).toEqual([
      'applications.csv',
      'stage_events.csv',
      'contacts.csv',
      'notes.csv',
      'resume_versions.csv',
    ]);
    expect(files['applications.csv']).toBe(
      '﻿company;position;source;applied_at;stage;salary;url;stage_history;id;search;location;work_mode;stack;match_score\r\n' +
        `Ромашка;Frontend Engineer;djinni;2026-10-01T09:00:00.000Z;rejected;1500-2500 USD;https://djinni.co/jobs/42;"applied@2026-10-01T09:00:00.000Z;screening@2026-10-03T09:00:00.000Z;rejected@2026-10-05T09:00:00.000Z:skills_gap";${APPLICATION_ID};Пошук 2026;Київ;remote;React, TypeScript;72\r\n`,
    );
    expect(storage.objects.get(keyOf(OLENA_ID, EXPORT_ID))?.mime).toBe('application/zip');
  });

  it('writes the same tables as json objects keyed by the column, with the reason label', async () => {
    const { service, storage } = await exportService();

    await service.build(requested('json'));

    const files = zipFilesAt(storage, keyOf(OLENA_ID, EXPORT_ID));
    expect(JSON.parse(files['stage_events.json'] ?? '[]')).toEqual([
      {
        application_id: APPLICATION_ID,
        from_stage: '',
        to_stage: 'applied',
        reason_code: '',
        reason: '',
        comment: '',
        occurred_at: '2026-10-01T09:00:00.000Z',
      },
      {
        application_id: APPLICATION_ID,
        from_stage: 'applied',
        to_stage: 'screening',
        reason_code: '',
        reason: '',
        comment: '',
        occurred_at: '2026-10-03T09:00:00.000Z',
      },
      {
        application_id: APPLICATION_ID,
        from_stage: 'screening',
        to_stage: 'rejected',
        reason_code: 'skills_gap',
        reason: 'Не вистачає скілів',
        comment: 'Мало досвіду з Next',
        occurred_at: '2026-10-05T09:00:00.000Z',
      },
    ]);
    expect(JSON.parse(files['contacts.json'] ?? '[]')).toEqual([
      {
        application_id: APPLICATION_ID,
        name: 'Ірина',
        role: 'HR',
        email: 'iryna@romashka.test',
        telegram: '',
        phone: '',
        note: '',
      },
    ]);
    expect(JSON.parse(files['notes.json'] ?? '[]')).toEqual([
      {
        application_id: APPLICATION_ID,
        body: 'Тестове на 3 дні',
        created_at: '2026-10-02T09:00:00.000Z',
      },
    ]);
  });

  it("removes the user's older export before storing the new one and keeps another user's", async () => {
    const storage = new FakeFileStorage();
    const zip = { bytes: new Uint8Array([1]), mime: 'application/zip' };
    await storage.put({ key: keyOf(OLENA_ID, OLDER_EXPORT_ID), ...zip });
    await storage.put({ key: keyOf(BOHDAN_ID, OLDER_EXPORT_ID), ...zip });
    const { service } = await exportService({ storage });

    await service.build(requested('csv'));

    expect([...storage.objects.keys()].sort()).toEqual(
      [keyOf(BOHDAN_ID, OLDER_EXPORT_ID), keyOf(OLENA_ID, EXPORT_ID)].sort(),
    );
  });

  it('records export_ready once per export, also when the build runs again', async () => {
    const { service, notifications } = await exportService();

    await service.build(requested('csv'));
    await service.build(requested('csv'));

    expect(notifications.notifications).toEqual([
      { userId: OLENA_ID, type: 'export_ready', payload: { exportId: EXPORT_ID, format: 'csv' } },
    ]);
  });

  it('stores nothing and records nothing for an account deleted since the request', async () => {
    const { service, repository, storage, notifications } = await exportService();
    repository.data.delete(OLENA_ID);

    await service.build(requested('csv'));

    expect([storage.objects.size, notifications.notifications.length]).toEqual([0, 0]);
  });

  it('an export finished after the deletion leaves no object', async () => {
    const repository = new FakeAccountExportRepository();
    const storage = new DeletedDuringPutStorage(() => repository.data.delete(OLENA_ID));
    const { service, notifications } = await exportService({ storage, repository });

    await service.build(requested('csv'));

    expect([storage.keysUnder(`users/${OLENA_ID}/`), notifications.notifications]).toEqual([
      [],
      [],
    ]);
  });

  it('an export whose cleanup failed after the deletion leaves no object after its retry', async () => {
    const repository = new FakeAccountExportRepository();
    const storage = new DeleteFailsOnceStorage(() => repository.data.delete(OLENA_ID));
    const { service } = await exportService({ storage, repository });

    await expect(service.build(requested('csv'))).rejects.toMatchObject({ status: 503 });
    await service.build(requested('csv'));

    expect(storage.keysUnder(`users/${OLENA_ID}/`)).toEqual([]);
  });

  it('fails for a retry and records no notification while the file storage is down', async () => {
    const { service, notifications } = await exportService({ storage: new DownFileStorage() });

    await expect(service.build(requested('csv'))).rejects.toMatchObject({ status: 503 });
    expect(notifications.notifications).toEqual([]);
  });
});
