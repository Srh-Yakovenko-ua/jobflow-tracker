import type { ResumeMime } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { FileStorage } from '../../storage/file-storage.js';
import { fakeTransactionModule } from '../../test/fake-prisma.js';
import { FAKE_STORAGE_URL, FakeFileStorage, type FakeObject } from '../../test/file-storage.js';
import { BOHDAN_ID, OLENA_ID } from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';
import { ResumeUploadsService } from './resume-uploads.service.js';

const PDF: ResumeMime = 'application/pdf';

const DOCX: ResumeMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const UPLOAD_ID = '6f1c2b9e-3d4a-4f5b-8c6d-7e8f9a0b1c2d';

const PDF_KEY = `users/${OLENA_ID}/resumes/${UPLOAD_ID}.pdf`;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const PDF_BYTES = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);

const DOCX_BYTES = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);

const EXE_BYTES = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

const OVER_LIMIT_PDF = new Uint8Array(5_242_881);
OVER_LIMIT_PDF.set(PDF_BYTES);

async function serviceWithStorage() {
  const storage = new FakeFileStorage();
  const moduleRef = await fakeTransactionModule({
    providers: [ResumeUploadsService, { provide: FileStorage, useValue: storage }],
    now: NOW,
  }).compile();
  return { storage, service: moduleRef.get(ResumeUploadsService) };
}

describe('ResumeUploadsService.createUploadTicket', () => {
  it("signs a PUT for a new v4 uploadId under the token user's key, valid 10 minutes from now", async () => {
    const { storage, service } = await serviceWithStorage();

    const { uploadId, ...ticket } = await service.createUploadTicket(OLENA_ID, {
      filename: 'cv.pdf',
      mime: PDF,
      sizeBytes: 184_320,
    });

    const key = `users/${OLENA_ID}/resumes/${uploadId}.pdf`;
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
      `users/${BOHDAN_ID}/resumes/${first.uploadId}.docx`,
      `users/${BOHDAN_ID}/resumes/${second.uploadId}.docx`,
    ]);
  });
});

describe('ResumeUploadsService.confirm', () => {
  it.each([
    { format: 'PDF', mime: PDF, object: { bytes: PDF_BYTES, mime: PDF }, sizeBytes: 9 },
    { format: 'DOCX', mime: DOCX, object: { bytes: DOCX_BYTES, mime: DOCX }, sizeBytes: 8 },
  ])('confirms a stored $format whose first bytes match it and keeps the file', async (row) => {
    const { storage, service } = await serviceWithStorage();
    const key = `users/${OLENA_ID}/resumes/${UPLOAD_ID}.${row.format.toLowerCase()}`;
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
