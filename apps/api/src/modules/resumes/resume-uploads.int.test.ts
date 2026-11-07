import {
  confirmedResumeUploadSchema,
  type ResumeUploadInput,
  type ResumeUploadTicket,
  resumeUploadTicketSchema,
} from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { FileStorage } from '../../storage/file-storage.js';
import { useTestApp } from '../../test/app.js';
import { accessTokenFor } from '../../test/auth.js';
import { createUser } from '../../test/factories.js';
import { callRoute, errorPathsOf } from '../../test/http.js';
import { resumeStorageKey } from './resume-storage-key.js';

const UPLOADS_PATH = '/api/v1/uploads/resume';

const PDF = 'application/pdf';

const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

const EXE_BYTES = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00]);

const NEVER_UPLOADED_ID = '6f1c2b9e-3d4a-4f5b-8c6d-7e8f9a0b1c2d';

const confirmPath = (uploadId: string) => `${UPLOADS_PATH}/${uploadId}/confirm`;

const pdfOfSize = (sizeBytes: number): ResumeUploadInput => ({
  filename: 'cv.pdf',
  mime: PDF,
  sizeBytes,
});

type Uploader = { userId: string; accessToken: string };

type Upload = { owner: Uploader; ticket: ResumeUploadTicket };

describe('POST /uploads/resume and POST /uploads/resume/:uploadId/confirm', () => {
  const testApp = useTestApp();

  async function signedIn(): Promise<Uploader> {
    const user = await createUser(testApp.prisma);
    return { userId: user.id, accessToken: await accessTokenFor(user) };
  }

  const askTicket = (accessToken: string | undefined, body: ResumeUploadInput) =>
    callRoute(testApp.app, { method: 'post', path: UPLOADS_PATH, body, accessToken });

  const confirm = (accessToken: string | undefined, uploadId: string) =>
    callRoute(testApp.app, {
      method: 'post',
      path: confirmPath(uploadId),
      body: { mime: PDF },
      accessToken,
    });

  async function uploadedPdf(bytes: Uint8Array): Promise<Upload> {
    const owner = await signedIn();
    const reply = await askTicket(owner.accessToken, pdfOfSize(bytes.length));
    const ticket = resumeUploadTicketSchema.parse(reply.body);
    const put = await fetch(ticket.url, {
      method: ticket.method,
      headers: ticket.headers,
      body: bytes,
    });
    if (!put.ok) {
      throw new Error(`The presigned PUT answered ${String(put.status)}`);
    }
    return { owner, ticket };
  }

  const storedHead = ({ owner, ticket }: Upload) =>
    testApp.app
      .get(FileStorage)
      .head(resumeStorageKey({ userId: owner.userId, uploadId: ticket.uploadId, mime: PDF }));

  it('answers 422 at sizeBytes for an 8.4 MB file and signs no URL', async () => {
    const { accessToken } = await signedIn();

    const response = await askTicket(accessToken, pdfOfSize(8_808_038));

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['sizeBytes']]);
    expect(response.body).not.toHaveProperty('url');
  });

  it("answers 201 with a PUT ticket under the user's own key, valid 10 minutes", async () => {
    const { userId, accessToken } = await signedIn();

    const response = await askTicket(accessToken, pdfOfSize(PDF_BYTES.length));

    const ticket = resumeUploadTicketSchema.parse(response.body);
    const url = new URL(ticket.url);
    expect([response.status, url.pathname, url.searchParams.get('X-Amz-Expires')]).toEqual([
      201,
      `/resumes/users/${userId}/resumes/${ticket.uploadId}.pdf`,
      '600',
    ]);
  });

  it('confirms an uploaded PDF with 200 and its size', async () => {
    const { owner, ticket } = await uploadedPdf(PDF_BYTES);

    const response = await confirm(owner.accessToken, ticket.uploadId);

    expect([response.status, confirmedResumeUploadSchema.parse(response.body)]).toEqual([
      200,
      { uploadId: ticket.uploadId, mime: PDF, sizeBytes: PDF_BYTES.length },
    ]);
  });

  it('refuses an .exe uploaded as a PDF at confirm with 422 at file and deletes it', async () => {
    const upload = await uploadedPdf(EXE_BYTES);

    const response = await confirm(upload.owner.accessToken, upload.ticket.uploadId);

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['file']]);
    expect(await storedHead(upload)).toBeNull();
  });

  it("answers 404 for another user's uploadId and keeps the owner's file", async () => {
    const upload = await uploadedPdf(PDF_BYTES);
    const stranger = await signedIn();

    const response = await confirm(stranger.accessToken, upload.ticket.uploadId);

    expect(response.status).toBe(404);
    expect(await storedHead(upload)).toEqual({ sizeBytes: PDF_BYTES.length, mime: PDF });
  });

  it('answers 401 without a token on both routes', async () => {
    const ticket = await askTicket(undefined, pdfOfSize(PDF_BYTES.length));
    const confirmed = await confirm(undefined, NEVER_UPLOADED_ID);

    expect([ticket.status, confirmed.status]).toEqual([401, 401]);
  });
});
