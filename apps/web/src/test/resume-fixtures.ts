import {
  type ConfirmedResumeUpload,
  confirmResumeUploadInputSchema,
  type CreateResumeVersionInput,
  createResumeVersionInputSchema,
  relinkResumeVersionInputSchema,
  type ResumeDownload,
  type ResumeUploadInput,
  resumeUploadInputSchema,
  type ResumeUploadTicket,
  type ResumeVersion,
  type ResumeVersionListResponse,
  resumeVersionSchema,
  type UpdateResumeVersionInput,
  updateResumeVersionInputSchema,
} from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl } from './api-handlers';
import { fixtureIdOf, heldReply, type MoveRouteOptions } from './board-fixtures';
import { meRoute, meWithSettings } from './session-fixtures';
import { storageReply, storageRoutes } from './storage-handlers';
import { storedRoutes, type StoredRoutesSetup, type StoredRoutesSpec } from './stored-routes';

export type UploadRoutesOptions = {
  ticket?: HttpResponseResolver;
  storage?: HttpResponseResolver;
  confirm?: HttpResponseResolver;
};

export type ResumeRoutesOptions = StoredRoutesSetup<ResumeVersion> &
  UploadRoutesOptions & { activeId?: string | null; relink?: MoveRouteOptions };

type ResumeSession = { activeId: string | null };

type VersionParams = { id: string };

type UploadsSent = { tickets: ResumeUploadInput[]; stored: number[]; confirms: string[] };

type Relinked = { applicationId: string; resumeVersionId: string };

type ActionsSent = { activated: string[]; downloaded: string[]; relinked: Relinked[] };

const SERIAL_FROM = 500;

const VERSIONS_PATH = '/resumes/versions';

const FRESH_VERSION = { aiProfileStatus: 'queued', applicationsCount: 0 } as const;

export const RESUME_STORAGE_URL = 'http://localhost:9000/resumes/upload-1';

export const UPLOAD_ID = fixtureIdOf(801);

export const SIGNED_EXPIRY = '2026-11-11T10:10:00.000Z';

export function downloadUrlOf(id: string): string {
  return `http://localhost:9000/resumes/${id}.pdf?X-Amz-Signature=signed`;
}

export function buildResumeVersion(overrides: Partial<ResumeVersion> = {}): ResumeVersion {
  return resumeVersionSchema.parse({
    id: fixtureIdOf(SERIAL_FROM + 1),
    number: 1,
    title: 'акцент на продукті',
    note: null,
    filename: 'andrii_cv.pdf',
    mime: 'application/pdf',
    sizeBytes: 219_136,
    isArchived: false,
    uploadedAt: '2026-08-09T09:30:00.000Z',
    aiProfileStatus: 'done',
    applicationsCount: 27,
    ...overrides,
  });
}

export function resumeVersionIdOf(number: number): string {
  return fixtureIdOf(SERIAL_FROM + number);
}

export function buildResumeVersions(count: number): ResumeVersion[] {
  return Array.from({ length: count }, (_, offset) => {
    const number = count - offset;
    return buildResumeVersion({
      id: resumeVersionIdOf(number),
      number,
      title: `версія ${String(number)}`,
      filename: `cv_v${String(number)}.pdf`,
    });
  });
}

function versionsSpec(session: ResumeSession, numbered: { last: number }) {
  const spec: StoredRoutesSpec<ResumeVersion, CreateResumeVersionInput, UpdateResumeVersionInput> =
    {
      path: VERSIONS_PATH,
      pageOf: (items): ResumeVersionListResponse => ({
        items: [...items].sort((left, right) => right.number - left.number),
      }),
      creating: {
        schema: createResumeVersionInputSchema,
        build: ({ body: { title, filename, mime }, id }) => {
          numbered.last += 1;
          return buildResumeVersion({
            id,
            number: numbered.last,
            title,
            filename,
            mime,
            ...FRESH_VERSION,
          });
        },
      },
      updating: {
        schema: updateResumeVersionInputSchema,
        merge: ({ stored, patch }) => {
          if (patch.isArchived === true && session.activeId === stored.id) session.activeId = null;
          return resumeVersionSchema.parse({ ...stored, ...patch });
        },
      },
    };
  return spec;
}

function ticketOf({ mime }: ResumeUploadInput): ResumeUploadTicket {
  return {
    uploadId: UPLOAD_ID,
    url: `${RESUME_STORAGE_URL}?X-Amz-Signature=signed`,
    method: 'PUT',
    headers: { 'Content-Type': mime },
    expiresAt: SIGNED_EXPIRY,
  };
}

function uploadRoutes({ ticket, storage, confirm }: UploadRoutesOptions) {
  const sent: UploadsSent = { tickets: [], stored: [], confirms: [] };
  const confirmed = async (info: Parameters<HttpResponseResolver<{ uploadId: string }>>[0]) => {
    const { mime } = confirmResumeUploadInputSchema.parse(await info.request.json());
    const sizeBytes = sent.tickets.at(-1)?.sizeBytes ?? 1;
    const upload: ConfirmedResumeUpload = { uploadId: info.params.uploadId, mime, sizeBytes };
    return HttpResponse.json(upload);
  };
  const handlers = [
    http.post(apiUrl('/uploads/resume'), async (info) => {
      const body = resumeUploadInputSchema.parse(await info.request.clone().json());
      sent.tickets.push(body);
      return ticket === undefined ? HttpResponse.json(ticketOf(body)) : ticket(info);
    }),
    ...storageRoutes(RESUME_STORAGE_URL, async (info) => {
      sent.stored.push((await info.request.clone().arrayBuffer()).byteLength);
      return storage === undefined ? storageReply(200) : storage(info);
    }),
    http.post<{ uploadId: string }>(apiUrl('/uploads/resume/:uploadId/confirm'), (info) => {
      sent.confirms.push(info.params.uploadId);
      return confirm === undefined ? confirmed(info) : confirm(info);
    }),
  ];
  return { handlers, sent };
}

function relinkRoute(sent: ActionsSent, control: MoveRouteOptions) {
  return http.patch<VersionParams>(apiUrl('/applications/:id/resume-version'), async (info) => {
    const { resumeVersionId } = relinkResumeVersionInputSchema.parse(await info.request.json());
    sent.relinked.push({ applicationId: info.params.id, resumeVersionId });
    return heldReply({ ...control, info, fallback: () => new HttpResponse(null, { status: 204 }) });
  });
}

function versionActionRoutes(session: ResumeSession, relink: MoveRouteOptions) {
  const sent: ActionsSent = { activated: [], downloaded: [], relinked: [] };
  const handlers = [
    relinkRoute(sent, relink),
    http.post<VersionParams>(apiUrl(`${VERSIONS_PATH}/:id/activate`), ({ params }) => {
      sent.activated.push(params.id);
      session.activeId = params.id;
      return new HttpResponse(null, { status: 204 });
    }),
    http.get<VersionParams>(apiUrl(`${VERSIONS_PATH}/:id/download`), ({ params }) => {
      sent.downloaded.push(params.id);
      const download: ResumeDownload = { url: downloadUrlOf(params.id), expiresAt: SIGNED_EXPIRY };
      return HttpResponse.json(download);
    }),
  ];
  return { handlers, sent };
}

export function resumeRoutes({
  activeId = null,
  relink = {},
  ...options
}: ResumeRoutesOptions = {}) {
  const session: ResumeSession = { activeId };
  const numbered = { last: Math.max(0, ...(options.items ?? []).map(({ number }) => number)) };
  const versions = storedRoutes(versionsSpec(session, numbered), options);
  const uploads = uploadRoutes(options);
  const actions = versionActionRoutes(session, relink);
  const me = () => HttpResponse.json(meWithSettings({ activeResumeVersionId: session.activeId }));
  return {
    handlers: [meRoute(me), ...versions.handlers, ...uploads.handlers, ...actions.handlers],
    session,
    store: versions.store,
    sent: { ...versions.sent, ...uploads.sent, ...actions.sent },
  };
}
