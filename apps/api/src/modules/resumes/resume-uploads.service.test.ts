import type { CreateResumeVersionInput, ResumeMime } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { FileStorage, type ObjectStart } from '../../storage/file-storage.js';
import { AI_JOB_ID, FakeAiRepository } from '../../test/ai.js';
import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import { FAKE_STORAGE_URL, FakeFileStorage, type FakeObject } from '../../test/file-storage.js';
import { type ByUser, RecordedEvents } from '../../test/recorded-events.js';
import {
  BOHDAN_ID,
  OLENA_ID,
  RESUME_VERSION_ID,
  RESUME_VERSION_ROW,
  UPLOAD_ID,
} from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';
import { AiService } from '../ai/index.js';
import { ResumeUploadsService } from './resume-uploads.service.js';
import { ResumeVersionWriter } from './resume-version-writer.js';
import {
  type InsertResumeVersion,
  type RecordResumeEvent,
  type ResumeVersionRow,
  ResumeVersionsRepository,
  type VersionByStorageKey,
} from './resume-versions.repository.js';

const PDF: ResumeMime = 'application/pdf';

const DOCX: ResumeMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const RESUME_ID = '0199f0a0-0000-7000-8000-0000000000b0';

const PDF_KEY = `pending/users/${OLENA_ID}/resumes/${UPLOAD_ID}.pdf`;

const VERSION_KEY = `users/${OLENA_ID}/resumes/${UPLOAD_ID}.pdf`;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const PDF_BYTES = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);

const DOCX_BYTES = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);

const EXE_BYTES = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

const OVER_LIMIT_PDF = new Uint8Array(5_242_881);
OVER_LIMIT_PDF.set(PDF_BYTES);

const VERSION_INPUT: CreateResumeVersionInput = {
  uploadId: UPLOAD_ID,
  filename: 'Olena CV.pdf',
  mime: PDF,
  title: 'для продуктових',
  note: 'акцент на продукті',
};

const CREATED_ROW: ResumeVersionRow = {
  ...RESUME_VERSION_ROW,
  number: 3,
  note: 'акцент на продукті',
};

class FakeResumeVersionsRepository extends RecordedEvents<RecordResumeEvent> {
  readonly locked: string[] = [];
  readonly inserted: ByUser<InsertResumeVersion>[] = [];
  readonly storageKeys = new Set<string>();

  lockOwner(userId: string): Promise<void> {
    this.locked.push(userId);
    return Promise.resolve();
  }

  findByStorageKey(_userId: string, { storageKey }: VersionByStorageKey) {
    return Promise.resolve(this.storageKeys.has(storageKey) ? { id: RESUME_VERSION_ID } : null);
  }

  findOrCreateResume(): Promise<string> {
    return Promise.resolve(RESUME_ID);
  }

  nextNumber(): Promise<number> {
    return Promise.resolve(3);
  }

  insert(userId: string, input: InsertResumeVersion): Promise<ResumeVersionRow> {
    this.inserted.push({ userId, ...input });
    return Promise.resolve(CREATED_ROW);
  }
}

class StorageWrittenAgainAfterCheck extends FakeFileStorage {
  override async readStart(start: ObjectStart): Promise<Uint8Array> {
    const read = await super.readStart(start);
    const object = this.objects.get(start.key);
    if (object) {
      this.objects.set(start.key, object);
    }
    return read;
  }
}

class StorageSwappedWhileSignatureRead extends FakeFileStorage {
  override async readStart(start: ObjectStart): Promise<Uint8Array> {
    const written = this.objects.get(start.key);
    const etag = this.objects.etags.get(start.key);
    this.objects.set(start.key, { bytes: PDF_BYTES, mime: PDF });
    const read = await super.readStart(start);
    if (written !== undefined && etag !== undefined) {
      this.objects.set(start.key, written);
      this.objects.etags.set(start.key, etag);
    }
    return read;
  }
}

async function serviceWithStorage(storage = new FakeFileStorage()) {
  const repository = new FakeResumeVersionsRepository();
  const ai = new FakeAiRepository();
  const moduleRef = await fakeTransactionModule({
    providers: [
      ResumeUploadsService,
      ResumeVersionWriter,
      ResumeVersionsRepository,
      { provide: FileStorage, useValue: storage },
      { provide: AiService, useValue: ai },
    ],
    now: NOW,
  })
    .overrideProvider(ResumeVersionsRepository)
    .useValue(repository)
    .compile();
  return { storage, repository, ai, service: moduleRef.get(ResumeUploadsService) };
}

describe('ResumeUploadsService.createUploadTicket', () => {
  it("signs a PUT for a new v4 uploadId under the token user's pending key, valid 10 minutes from now", async () => {
    const { storage, service } = await serviceWithStorage();

    const { uploadId, ...ticket } = await service.createUploadTicket(OLENA_ID, {
      filename: 'cv.pdf',
      mime: PDF,
      sizeBytes: 184_320,
    });

    const key = `pending/users/${OLENA_ID}/resumes/${uploadId}.pdf`;
    expect(uploadId).toMatch(UUID_V4);
    expect(ticket).toEqual({
      url: `${FAKE_STORAGE_URL}${key}`,
      method: 'PUT',
      headers: { 'Content-Type': PDF },
      expiresAt: '2026-10-22T09:10:00.000Z',
    });
    expect(storage.signed).toEqual([{ key, mime: PDF, sizeBytes: 184_320, signedAt: NOW }]);
  });

  it('gives a DOCX a .docx key and every ticket its own uploadId', async () => {
    const { storage, service } = await serviceWithStorage();
    const input = { filename: 'cv.docx', mime: DOCX, sizeBytes: 52_000 };

    const first = await service.createUploadTicket(BOHDAN_ID, input);
    const second = await service.createUploadTicket(BOHDAN_ID, input);

    expect(first.uploadId).not.toBe(second.uploadId);
    expect(storage.signed.map(({ key }) => key)).toEqual([
      `pending/users/${BOHDAN_ID}/resumes/${first.uploadId}.docx`,
      `pending/users/${BOHDAN_ID}/resumes/${second.uploadId}.docx`,
    ]);
  });
});

describe('ResumeUploadsService.confirm', () => {
  it.each([
    { format: 'PDF', mime: PDF, object: { bytes: PDF_BYTES, mime: PDF }, sizeBytes: 9 },
    { format: 'DOCX', mime: DOCX, object: { bytes: DOCX_BYTES, mime: DOCX }, sizeBytes: 8 },
  ])('confirms a stored $format whose first bytes match it and keeps the file', async (row) => {
    const { storage, service } = await serviceWithStorage();
    const key = `pending/users/${OLENA_ID}/resumes/${UPLOAD_ID}.${row.format.toLowerCase()}`;
    storage.objects.set(key, row.object);

    const confirmed = await service.confirm(OLENA_ID, { uploadId: UPLOAD_ID, mime: row.mime });

    expect(confirmed).toEqual({ uploadId: UPLOAD_ID, mime: row.mime, sizeBytes: row.sizeBytes });
    expect([storage.deleted, storage.objects.has(key)]).toEqual([[], true]);
  });

  it("answers 404 for an uploadId under another user's key and keeps that file", async () => {
    const { storage, service } = await serviceWithStorage();
    storage.objects.set(PDF_KEY, { bytes: PDF_BYTES, mime: PDF });

    await expect(
      service.confirm(BOHDAN_ID, { uploadId: UPLOAD_ID, mime: PDF }),
    ).rejects.toMatchObject({
      body: { status: 404, type: 'not_found', detail: 'Upload not found' },
    });
    expect([storage.deleted, storage.objects.has(PDF_KEY)]).toEqual([[], true]);
  });

  it.each<{ case: string; object: FakeObject; message: string }>([
    {
      case: 'an .exe uploaded as a PDF',
      object: { bytes: EXE_BYTES, mime: PDF },
      message: 'The file content is not a PDF or DOCX',
    },
    {
      case: 'a DOCX uploaded as a PDF',
      object: { bytes: DOCX_BYTES, mime: PDF },
      message: 'The file content is not a PDF or DOCX',
    },
    {
      case: 'a file stored with a type other than the declared one',
      object: { bytes: PDF_BYTES, mime: DOCX },
      message: 'The file was stored with a type other than application/pdf',
    },
    {
      case: 'a stored file over 5 MiB',
      object: { bytes: OVER_LIMIT_PDF, mime: PDF },
      message: 'The file is larger than 5242880 bytes',
    },
  ])('refuses $case with 422 at file and deletes it', async ({ object, message }) => {
    const { storage, service } = await serviceWithStorage();
    storage.objects.set(PDF_KEY, object);

    await expect(
      service.confirm(OLENA_ID, { uploadId: UPLOAD_ID, mime: PDF }),
    ).rejects.toMatchObject({
      body: { status: 422, type: 'validation_error', errors: [{ path: 'file', message }] },
    });
    expect([storage.deleted, storage.objects.has(PDF_KEY)]).toEqual([[PDF_KEY], false]);
  });
});

describe('ResumeUploadsService.createVersion', () => {
  it('copies the checked bytes to the version key and inserts the next version with its queued resume_parse job and one resume.version_uploaded event naming that job', async () => {
    const { storage, repository, ai, service } = await serviceWithStorage();
    storage.objects.set(PDF_KEY, { bytes: PDF_BYTES, mime: PDF });

    const version = await service.createVersion(OLENA_ID, VERSION_INPUT);

    expect(repository.locked).toEqual([OLENA_ID]);
    expect(storage.copies).toEqual([{ from: PDF_KEY, to: VERSION_KEY, ifMatch: '"etag-1"' }]);
    expect(repository.inserted).toEqual([
      {
        userId: OLENA_ID,
        data: {
          resumeId: RESUME_ID,
          number: 3,
          storageKey: VERSION_KEY,
          filename: 'Olena CV.pdf',
          mime: PDF,
          sizeBytes: 9,
          title: 'для продуктових',
          note: 'акцент на продукті',
          uploadedAt: NOW,
        },
        tx: FAKE_TRANSACTION,
      },
    ]);
    expect(repository.events).toEqual([
      {
        userId: OLENA_ID,
        event: {
          eventType: 'resume.version_uploaded',
          resumeVersionId: RESUME_VERSION_ID,
          aiJobId: AI_JOB_ID,
        },
        tx: FAKE_TRANSACTION,
      },
    ]);
    expect([...ai.jobs]).toEqual([
      [
        AI_JOB_ID,
        { userId: OLENA_ID, status: 'queued', step: 1, resumeVersionId: RESUME_VERSION_ID },
      ],
    ]);
    expect(version).toEqual({
      id: RESUME_VERSION_ID,
      number: 3,
      title: 'для продуктових',
      note: 'акцент на продукті',
      filename: 'Olena CV.pdf',
      mime: PDF,
      sizeBytes: 9,
      isArchived: false,
      uploadedAt: '2026-10-22T09:00:00.000Z',
      aiProfileStatus: 'queued',
      applicationsCount: 0,
    });
  });

  it('answers 409 when the file was written again after the check and inserts nothing', async () => {
    const { storage, repository, service } = await serviceWithStorage(
      new StorageWrittenAgainAfterCheck(),
    );
    storage.objects.set(PDF_KEY, { bytes: PDF_BYTES, mime: PDF });

    await expect(service.createVersion(OLENA_ID, VERSION_INPUT)).rejects.toMatchObject({
      body: {
        status: 409,
        type: 'conflict',
        detail: 'The file changed after the check; upload it again',
      },
    });
    expect([storage.objects.has(VERSION_KEY), repository.inserted, repository.events]).toEqual([
      false,
      [],
      [],
    ]);
  });

  it.each<{ case: string; storage: () => FakeFileStorage }>([
    { case: 'a file without the PDF signature', storage: () => new FakeFileStorage() },
    {
      case: 'EXE bytes swapped for a PDF only while the signature is read',
      storage: () => new StorageSwappedWhileSignatureRead(),
    },
  ])('refuses $case with 422 at file, deletes it and copies nothing', async (row) => {
    const { storage, repository, service } = await serviceWithStorage(row.storage());
    storage.objects.set(PDF_KEY, { bytes: EXE_BYTES, mime: PDF });

    await expect(service.createVersion(OLENA_ID, VERSION_INPUT)).rejects.toMatchObject({
      body: {
        status: 422,
        errors: [{ path: 'file', message: 'The file content is not a PDF or DOCX' }],
      },
    });
    expect([storage.deleted, storage.copies, repository.inserted]).toEqual([[PDF_KEY], [], []]);
  });

  it('answers 409 for an upload that already has a version and copies nothing', async () => {
    const { storage, repository, service } = await serviceWithStorage();
    storage.objects.set(PDF_KEY, { bytes: PDF_BYTES, mime: PDF });
    repository.storageKeys.add(VERSION_KEY);

    await expect(service.createVersion(OLENA_ID, VERSION_INPUT)).rejects.toMatchObject({
      body: { status: 409, type: 'conflict', detail: 'A version from this upload already exists' },
    });
    expect([storage.copies, repository.inserted, repository.events]).toEqual([[], [], []]);
  });

  it("answers 404 for an upload under another user's key and keeps that file", async () => {
    const { storage, repository, service } = await serviceWithStorage();
    storage.objects.set(PDF_KEY, { bytes: PDF_BYTES, mime: PDF });

    await expect(service.createVersion(BOHDAN_ID, VERSION_INPUT)).rejects.toMatchObject({
      body: { status: 404, detail: 'Upload not found' },
    });
    expect([storage.deleted, storage.copies, repository.inserted]).toEqual([[], [], []]);
  });
});
