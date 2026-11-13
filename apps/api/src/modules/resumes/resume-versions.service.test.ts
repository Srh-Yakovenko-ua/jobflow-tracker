import { describe, expect, it } from 'vitest';

import { FileStorage } from '../../storage/file-storage.js';
import { AI_JOB_ID } from '../../test/ai.js';
import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import { FAKE_STORAGE_URL, FakeFileStorage } from '../../test/file-storage.js';
import { type ByUser } from '../../test/recorded-events.js';
import { ActiveVersions } from '../../test/resumes.js';
import {
  BOHDAN_ID,
  OLENA_ID,
  RESUME_VERSION_ID,
  RESUME_VERSION_ROW,
  UPLOAD_ID,
} from '../../test/service-fixtures.js';
import { daysBefore, NOW } from '../../test/time.js';
import {
  type ResumeVersionById,
  type ResumeVersionRow,
  ResumeVersionsRepository,
  type SetActiveVersion,
  type UpdateResumeVersion,
} from './resume-versions.repository.js';
import { ResumeVersionsService } from './resume-versions.service.js';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const STORAGE_KEY = `users/${OLENA_ID}/resumes/${UPLOAD_ID}.docx`;

const STORED_ROW: ResumeVersionRow = {
  ...RESUME_VERSION_ROW,
  number: 2,
  title: 'для аутсорсу',
  filename: 'Олена CV.docx',
  mime: DOCX,
  sizeBytes: 52_000,
  uploadedAt: daysBefore(2),
  storageKey: STORAGE_KEY,
  aiJobs: [{ id: AI_JOB_ID, status: 'processing', errorType: null }],
};

const VERSION_NOT_FOUND = {
  body: { status: 404, type: 'not_found', detail: 'Resume version not found' },
};

const LINKED_CONFLICT = {
  body: {
    status: 409,
    type: 'conflict',
    detail: 'The version is linked to applications; archive it instead',
  },
};

class FakeResumeVersionsRepository {
  readonly updates: ByUser<UpdateResumeVersion>[] = [];
  readonly deletedIds: string[] = [];
  readonly active = new ActiveVersions([
    [OLENA_ID, RESUME_VERSION_ID],
    [BOHDAN_ID, null],
  ]);
  stored = STORED_ROW;

  lockOwner(): Promise<void> {
    return Promise.resolve();
  }

  list(userId: string): Promise<ResumeVersionRow[]> {
    return Promise.resolve(userId === OLENA_ID ? [this.stored] : []);
  }

  findOwned(userId: string, { id }: ResumeVersionById): Promise<ResumeVersionRow | null> {
    return Promise.resolve(this.owns(userId, id) ? this.stored : null);
  }

  update(userId: string, input: UpdateResumeVersion): Promise<number> {
    if (!this.owns(userId, input.id)) {
      return Promise.resolve(0);
    }
    this.updates.push({ userId, ...input });
    const { isArchived = this.stored.isArchived, title = this.stored.title } = input.data;
    this.stored = { ...this.stored, isArchived, title };
    return Promise.resolve(1);
  }

  setActive(userId: string, input: SetActiveVersion): Promise<void> {
    return this.active.move(userId, input);
  }

  deleteUnlinked(userId: string, { id }: ResumeVersionById): Promise<number> {
    if (!this.owns(userId, id) || this.stored._count.applications > 0) {
      return Promise.resolve(0);
    }
    this.deletedIds.push(id);
    return Promise.resolve(1);
  }

  private owns(userId: string, id: string): boolean {
    return userId === OLENA_ID && id === this.stored.id;
  }
}

async function serviceWithFakes() {
  const repository = new FakeResumeVersionsRepository();
  const storage = new FakeFileStorage();
  const moduleRef = await fakeTransactionModule({
    providers: [
      ResumeVersionsService,
      ResumeVersionsRepository,
      { provide: FileStorage, useValue: storage },
    ],
    now: NOW,
  })
    .overrideProvider(ResumeVersionsRepository)
    .useValue(repository)
    .compile();
  return { repository, storage, service: moduleRef.get(ResumeVersionsService) };
}

describe('ResumeVersionsService.list', () => {
  it("lists the user's versions with the latest AI job status and done once a profile exists", async () => {
    const { repository, service } = await serviceWithFakes();
    const items = [(await service.list(OLENA_ID)).items];
    repository.stored = { ...STORED_ROW, aiProfile: { seniority: 'middle' } };
    items.push((await service.list(OLENA_ID)).items);

    expect(items).toEqual([
      [
        {
          id: RESUME_VERSION_ID,
          number: 2,
          title: 'для аутсорсу',
          note: null,
          filename: 'Олена CV.docx',
          mime: DOCX,
          sizeBytes: 52_000,
          isArchived: false,
          uploadedAt: '2026-10-20T09:00:00.000Z',
          aiProfileStatus: 'processing',
          applicationsCount: 0,
        },
      ],
      [expect.objectContaining({ aiProfileStatus: 'done' })],
    ]);
  });

  it.each([
    { failure: 'needs_text', aiProfileStatus: 'needs_text' },
    { failure: 'ai_timeout', aiProfileStatus: 'failed' },
    { failure: null, aiProfileStatus: 'failed' },
  ])(
    'shows $aiProfileStatus for a version whose latest AI job failed with $failure',
    async ({ failure, aiProfileStatus }) => {
      const { repository, service } = await serviceWithFakes();
      repository.stored = {
        ...STORED_ROW,
        aiJobs: [{ id: AI_JOB_ID, status: 'failed', errorType: failure }],
      };

      const { items } = await service.list(OLENA_ID);

      expect(items.map((item) => item.aiProfileStatus)).toEqual([aiProfileStatus]);
    },
  );
});

describe('ResumeVersionsService.update', () => {
  it('archives the active version, clears it as active in the same transaction and answers the item', async () => {
    const { repository, service } = await serviceWithFakes();

    const version = await service.update(OLENA_ID, {
      id: RESUME_VERSION_ID,
      input: { isArchived: true },
    });

    expect([version.isArchived, repository.active.get(OLENA_ID)]).toEqual([true, null]);
    expect(repository.updates).toEqual([
      {
        userId: OLENA_ID,
        id: RESUME_VERSION_ID,
        data: { isArchived: true, updatedAt: NOW },
        tx: FAKE_TRANSACTION,
      },
    ]);
  });

  it('keeps the active version when only the title changes', async () => {
    const { repository, service } = await serviceWithFakes();

    const version = await service.update(OLENA_ID, {
      id: RESUME_VERSION_ID,
      input: { title: 'для продуктових' },
    });

    expect([version.title, repository.active.get(OLENA_ID)]).toEqual([
      'для продуктових',
      RESUME_VERSION_ID,
    ]);
  });

  it("answers another user's version with 404 and changes nothing", async () => {
    const { repository, service } = await serviceWithFakes();

    await expect(
      service.update(BOHDAN_ID, { id: RESUME_VERSION_ID, input: { isArchived: true } }),
    ).rejects.toMatchObject(VERSION_NOT_FOUND);
    expect([repository.updates, repository.active.get(OLENA_ID)]).toEqual([[], RESUME_VERSION_ID]);
  });
});

describe('ResumeVersionsService.activate', () => {
  it('makes the version active for new applications', async () => {
    const { repository, service } = await serviceWithFakes();
    repository.active.set(OLENA_ID, null);

    await service.activate(OLENA_ID, RESUME_VERSION_ID);

    expect(repository.active.get(OLENA_ID)).toBe(RESUME_VERSION_ID);
  });

  it('refuses an archived version with 409 and keeps the active one', async () => {
    const { repository, service } = await serviceWithFakes();
    repository.active.set(OLENA_ID, null);
    repository.stored = { ...STORED_ROW, isArchived: true };

    await expect(service.activate(OLENA_ID, RESUME_VERSION_ID)).rejects.toMatchObject({
      body: { status: 409, detail: 'Unarchive the version before making it active' },
    });
    expect(repository.active.get(OLENA_ID)).toBeNull();
  });

  it("answers another user's version with 404 and sets nothing", async () => {
    const { repository, service } = await serviceWithFakes();

    await expect(service.activate(BOHDAN_ID, RESUME_VERSION_ID)).rejects.toMatchObject(
      VERSION_NOT_FOUND,
    );
    expect(repository.active.get(BOHDAN_ID)).toBeNull();
  });
});

describe('ResumeVersionsService.remove', () => {
  it('deletes an unlinked version and its file', async () => {
    const { repository, storage, service } = await serviceWithFakes();

    await service.remove(OLENA_ID, RESUME_VERSION_ID);

    expect([repository.deletedIds, storage.deleted]).toEqual([[RESUME_VERSION_ID], [STORAGE_KEY]]);
  });

  it('refuses a version linked to an application with 409 and the archive hint, keeping its file', async () => {
    const { repository, storage, service } = await serviceWithFakes();
    repository.stored = { ...STORED_ROW, _count: { applications: 1 } };

    await expect(service.remove(OLENA_ID, RESUME_VERSION_ID)).rejects.toMatchObject(
      LINKED_CONFLICT,
    );
    expect([repository.deletedIds, storage.deleted]).toEqual([[], []]);
  });

  it("answers another user's version with 404 and deletes nothing", async () => {
    const { repository, storage, service } = await serviceWithFakes();

    await expect(service.remove(BOHDAN_ID, RESUME_VERSION_ID)).rejects.toMatchObject(
      VERSION_NOT_FOUND,
    );
    expect([repository.deletedIds, storage.deleted]).toEqual([[], []]);
  });
});

describe('ResumeVersionsService.download', () => {
  it("signs the stored key with the row's type and filename, valid 5 minutes", async () => {
    const { storage, service } = await serviceWithFakes();

    const download = await service.download(OLENA_ID, RESUME_VERSION_ID);

    expect(storage.downloads).toEqual([
      { key: STORAGE_KEY, mime: DOCX, filename: 'Олена CV.docx', signedAt: NOW },
    ]);
    expect(download).toEqual({
      url: `${FAKE_STORAGE_URL}${STORAGE_KEY}`,
      expiresAt: '2026-10-22T09:05:00.000Z',
    });
  });

  it("answers another user's version with 404 and signs nothing", async () => {
    const { storage, service } = await serviceWithFakes();

    await expect(service.download(BOHDAN_ID, RESUME_VERSION_ID)).rejects.toMatchObject(
      VERSION_NOT_FOUND,
    );
    expect(storage.downloads).toEqual([]);
  });
});
