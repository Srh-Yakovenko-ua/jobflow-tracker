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
import {
  exeBytesOfLength,
  PDF,
  PDF_BYTES,
  PDF_ETAG,
  uploadedPdf,
  type Uploader,
  uploadResumeVersion,
  UPLOADS_PATH,
} from '../../test/resumes.js';
import { pendingResumeKey } from './resume-storage-key.js';

const NEVER_UPLOADED_ID = '6f1c2b9e-3d4a-4f5b-8c6d-7e8f9a0b1c2d';

const confirmPath = (uploadId: string) => `${UPLOADS_PATH}/${uploadId}/confirm`;

const pdfOfSize = (sizeBytes: number): ResumeUploadInput => ({
  filename: 'cv.pdf',
  mime: PDF,
  sizeBytes,
});

type SignedInUploader = Uploader & { userId: string };

type Upload = { owner: SignedInUploader; ticket: ResumeUploadTicket };

describe('POST /uploads/resume and POST /uploads/resume/:uploadId/confirm', () => {
  const testApp = useTestApp();

  async function signedIn(): Promise<SignedInUploader> {
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

  async function uploaded(bytes: Uint8Array): Promise<Upload> {
    const owner = await signedIn();
    return {
      owner,
      ticket: await uploadedPdf(testApp.app, { accessToken: owner.accessToken, bytes }),
    };
  }

  const storedHead = ({ owner, ticket }: Upload) =>
    testApp.app
      .get(FileStorage)
      .head(pendingResumeKey({ userId: owner.userId, uploadId: ticket.uploadId, mime: PDF }));

  it('answers 422 at sizeBytes for an 8.4 MB file and signs no URL', async () => {
    const { accessToken } = await signedIn();

    const response = await askTicket(accessToken, pdfOfSize(8_808_038));

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['sizeBytes']]);
    expect(response.body).not.toHaveProperty('url');
  });

  it("answers 201 with a PUT ticket under the pending prefix of the user's own key, valid 10 minutes", async () => {
    const { userId, accessToken } = await signedIn();

    const response = await askTicket(accessToken, pdfOfSize(PDF_BYTES.length));

    const ticket = resumeUploadTicketSchema.parse(response.body);
    const url = new URL(ticket.url);
    expect([response.status, url.pathname, url.searchParams.get('X-Amz-Expires')]).toEqual([
      201,
      `/resumes/pending/users/${userId}/resumes/${ticket.uploadId}.pdf`,
      '600',
    ]);
  });

  it('confirms an uploaded PDF with 200 and its size', async () => {
    const { owner, ticket } = await uploaded(PDF_BYTES);

    const response = await confirm(owner.accessToken, ticket.uploadId);

    expect([response.status, confirmedResumeUploadSchema.parse(response.body)]).toEqual([
      200,
      { uploadId: ticket.uploadId, mime: PDF, sizeBytes: PDF_BYTES.length },
    ]);
  });

  it('refuses an .exe uploaded as a PDF at confirm with 422 at file and deletes it', async () => {
    const upload = await uploaded(exeBytesOfLength(10));

    const response = await confirm(upload.owner.accessToken, upload.ticket.uploadId);

    expect([response.status, errorPathsOf(response.body)]).toEqual([422, ['file']]);
    expect(await storedHead(upload)).toBeNull();
  });

  it("answers 404 for another user's uploadId and keeps the owner's file", async () => {
    const upload = await uploaded(PDF_BYTES);
    const stranger = await signedIn();

    const response = await confirm(stranger.accessToken, upload.ticket.uploadId);

    expect(response.status).toBe(404);
    expect(await storedHead(upload)).toEqual({
      sizeBytes: PDF_BYTES.length,
      mime: PDF,
      etag: PDF_ETAG,
    });
  });

  it("makes version 1 active once it is created, keeps it after version 2 and leaves another user's settings alone", async () => {
    const owner = await signedIn();
    const stranger = await signedIn();
    const activeOf = async ({ userId }: SignedInUploader) =>
      (await testApp.prisma.userSettings.findUniqueOrThrow({ where: { userId } }))
        .activeResumeVersionId;

    const first = await uploadResumeVersion(testApp.app, owner);
    const afterFirst = await activeOf(owner);
    await uploadResumeVersion(testApp.app, owner);

    expect([afterFirst, await activeOf(owner), await activeOf(stranger)]).toEqual([
      first.version.id,
      first.version.id,
      null,
    ]);
  });

  it('answers 401 without a token on both routes', async () => {
    const ticket = await askTicket(undefined, pdfOfSize(PDF_BYTES.length));
    const confirmed = await confirm(undefined, NEVER_UPLOADED_ID);

    expect([ticket.status, confirmed.status]).toEqual([401, 401]);
  });
});
