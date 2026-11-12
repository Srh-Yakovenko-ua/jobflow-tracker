import {
  type CreateResumeVersionInput,
  type ResumeUploadTicket,
  resumeUploadTicketSchema,
  type ResumeVersion,
  resumeVersionSchema,
} from '@jobflow/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';

import type { ExtractedText, ProfileSource, ResumeProfile } from '../modules/resumes/index.js';
import { applicationPath } from './applications.js';
import { callRoute } from './http.js';
import { OLENA_ID, RESUME_VERSION_ID, RESUME_VERSION_ROW } from './service-fixtures.js';

export const UPLOADS_PATH = '/api/v1/uploads/resume';

export const RESUME_VERSIONS_PATH = '/api/v1/resumes/versions';

export const PDF = 'application/pdf';

export const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

export const PDF_ETAG = '"d30b5fe55438a917efa2cfe14a69c950"';

export type Uploader = { accessToken: string };

export type PdfUpload = Uploader & { bytes: Uint8Array };

export type VersionUpload = Uploader & Partial<Pick<CreateResumeVersionInput, 'title' | 'note'>>;

export type UploadedVersion = { ticket: ResumeUploadTicket; version: ResumeVersion };

export const exeBytesOfLength = (length: number) => {
  const bytes = new Uint8Array(length);
  bytes.set([0x4d, 0x5a, 0x90, 0x00]);
  return bytes;
};

export const resumeVersionPath = (id: string) => `${RESUME_VERSIONS_PATH}/${id}`;

export const activationPath = (id: string) => `${resumeVersionPath(id)}/activate`;

export const downloadPath = (id: string) => `${resumeVersionPath(id)}/download`;

export const resumeLinkPath = (applicationId: string) =>
  `${applicationPath(applicationId)}/resume-version`;

export async function putThroughTicket(ticket: ResumeUploadTicket, bytes: Uint8Array) {
  const put = await fetch(ticket.url, {
    method: ticket.method,
    headers: ticket.headers,
    body: bytes,
  });
  if (!put.ok) {
    throw new Error(`The presigned PUT answered ${String(put.status)}`);
  }
}

export async function uploadedPdf(
  app: NestExpressApplication,
  { accessToken, bytes }: PdfUpload,
): Promise<ResumeUploadTicket> {
  const reply = await callRoute(app, {
    method: 'post',
    path: UPLOADS_PATH,
    body: { filename: 'cv.pdf', mime: PDF, sizeBytes: bytes.length },
    accessToken,
  });
  const ticket = resumeUploadTicketSchema.parse(reply.body);
  await putThroughTicket(ticket, bytes);
  return ticket;
}

export function postResumeVersion(
  app: NestExpressApplication,
  {
    accessToken,
    ticket,
    title = 'для продуктових',
    note,
  }: VersionUpload & { ticket: Pick<ResumeUploadTicket, 'uploadId'> },
) {
  const body: CreateResumeVersionInput = {
    uploadId: ticket.uploadId,
    filename: 'cv.pdf',
    mime: PDF,
    title,
    note,
  };
  return callRoute(app, { method: 'post', path: RESUME_VERSIONS_PATH, body, accessToken });
}

export async function uploadResumeVersion(
  app: NestExpressApplication,
  upload: VersionUpload,
): Promise<UploadedVersion> {
  const ticket = await uploadedPdf(app, { accessToken: upload.accessToken, bytes: PDF_BYTES });
  const response = await postResumeVersion(app, { ...upload, ticket });
  return { ticket, version: resumeVersionSchema.parse(response.body) };
}

export const PROFILE_SOURCE: ProfileSource = {
  storageKey: RESUME_VERSION_ROW.storageKey,
  filename: RESUME_VERSION_ROW.filename,
  mime: RESUME_VERSION_ROW.mime,
  aiProfile: null,
};

const ownsVersion = (userId: string, id: string) => userId === OLENA_ID && id === RESUME_VERSION_ID;

function keep<T>(saved: T[], item: T): number {
  saved.push(item);
  return 1;
}

export class FakeProfileVersions {
  source: ProfileSource = PROFILE_SOURCE;

  readonly texts: ExtractedText[] = [];

  readonly profiles: ResumeProfile[] = [];

  findForProfile(userId: string, id: string): Promise<ProfileSource | null> {
    return Promise.resolve(ownsVersion(userId, id) ? this.source : null);
  }

  saveExtractedText(userId: string, text: ExtractedText): Promise<number> {
    return Promise.resolve(ownsVersion(userId, text.id) ? keep(this.texts, text) : 0);
  }

  saveProfile(userId: string, profile: ResumeProfile): Promise<number> {
    return Promise.resolve(ownsVersion(userId, profile.id) ? keep(this.profiles, profile) : 0);
  }
}
