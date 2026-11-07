import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  type CreateResumeVersionInput,
  createResumeVersionInputSchema,
  type RelinkResumeVersionInput,
  relinkResumeVersionInputSchema,
  RESUME_UPLOAD_LIMITS,
  RESUME_VERSION_LIMITS,
  type ResumeDownload,
  resumeDownloadSchema,
  type ResumeVersion,
  resumeVersionIdSchema,
  resumeVersionListResponseSchema,
  resumeVersionSchema,
  type UpdateResumeVersionInput,
  updateResumeVersionInputSchema,
} from '@jobflow/shared';
import { z } from 'zod';

import {
  applicationIdParams,
  errorResponses,
  EXAMPLE_RESUME_VERSION_ID,
  EXAMPLE_UPLOAD_ID,
  idempotencyHeaders,
  jsonContent,
} from '../../openapi/route.js';

const VERSIONS_PATH = '/resumes/versions';

const VERSION_PATH = `${VERSIONS_PATH}/{id}`;

const TAGS = ['resumes'];

const versionIdParams = z.object({
  id: resumeVersionIdSchema.meta({ example: EXAMPLE_RESUME_VERSION_ID }),
});

const VERSION_TEXT = { title: 'Акцент на продукті', note: 'Для продуктових компаній' };

const VERSION_FILE = {
  filename: 'Olena Kovalenko CV product.pdf',
  mime: 'application/pdf',
} satisfies Pick<CreateResumeVersionInput, 'filename' | 'mime'>;

const CREATE_INPUT = {
  uploadId: EXAMPLE_UPLOAD_ID,
  ...VERSION_FILE,
  ...VERSION_TEXT,
} satisfies CreateResumeVersionInput;

const VERSION = {
  id: EXAMPLE_RESUME_VERSION_ID,
  number: 2,
  ...VERSION_TEXT,
  ...VERSION_FILE,
  sizeBytes: 201_728,
  isArchived: false,
  uploadedAt: '2026-11-07T10:05:00.000Z',
  aiProfileStatus: 'done',
  applicationsCount: 3,
} satisfies ResumeVersion;

const ARCHIVE_INPUT = { isArchived: true } satisfies UpdateResumeVersionInput;

const RELINK_INPUT = {
  resumeVersionId: EXAMPLE_RESUME_VERSION_ID,
} satisfies RelinkResumeVersionInput;

const DOWNLOAD = {
  url: `http://localhost:9000/resumes/users/0199f0a0-0000-7000-8000-000000000001/resumes/${EXAMPLE_UPLOAD_ID}.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${String(RESUME_UPLOAD_LIMITS.downloadUrlTtlSeconds)}&response-content-type=application%2Fpdf&X-Amz-Signature=9e107d9d372bb6826bd81d3542a419d6`,
  expiresAt: '2026-11-07T10:10:00.000Z',
} satisfies ResumeDownload;

const TEXT_LIMITS = `title 1 to ${String(RESUME_VERSION_LIMITS.titleMaxLength)} characters of plain text, note at most ${String(RESUME_VERSION_LIMITS.noteMaxLength)} characters or null`;

const DOWNLOAD_TTL_MINUTES = String(RESUME_UPLOAD_LIMITS.downloadUrlTtlSeconds / 60);

const ownedErrors = errorResponses([401, 403, 404, 422]);

const ownedConflictErrors = errorResponses([401, 403, 404, 409, 422]);

export const RESUME_VERSIONS_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: VERSIONS_PATH,
    tags: TAGS,
    summary: 'List the resume versions of the signed-in user',
    description:
      'Every version, archived ones included, highest number first, with its AI profile status and the count of Applications linked to it.',
    responses: {
      200: {
        description: 'The resume versions',
        content: jsonContent(resumeVersionListResponseSchema, { items: [VERSION] }),
      },
      ...errorResponses([401, 403]),
    },
  },
  {
    method: 'post',
    path: VERSIONS_PATH,
    tags: TAGS,
    summary: 'Create a resume version from a confirmed upload',
    description:
      "Checks the pending upload again and copies it to the version's own key only while it is still the file checked; a file written again since answers 409. The first version creates the user's resume, each next one takes the next number, and one upload makes one version: a second create from it answers 409. A resume.version_uploaded event is written in the same transaction.",
    request: {
      headers: idempotencyHeaders,
      body: {
        required: true,
        description: `The uploadId, filename and mime of the upload; ${TEXT_LIMITS}.`,
        content: jsonContent(createResumeVersionInputSchema, CREATE_INPUT),
      },
    },
    responses: {
      201: {
        description: 'The created version',
        content: jsonContent(resumeVersionSchema, VERSION),
      },
      ...errorResponses([400, 401, 403, 404, 409, 422, 503]),
    },
  },
  {
    method: 'patch',
    path: VERSION_PATH,
    tags: TAGS,
    summary: 'Change the title, note or archive flag of a resume version',
    description: 'Archiving the active version clears the active version in the settings.',
    request: {
      params: versionIdParams,
      body: {
        required: true,
        description: `At least one of title, note and isArchived; ${TEXT_LIMITS}.`,
        content: jsonContent(updateResumeVersionInputSchema, ARCHIVE_INPUT),
      },
    },
    responses: {
      200: {
        description: 'The changed version',
        content: jsonContent(resumeVersionSchema, { ...VERSION, isArchived: true }),
      },
      ...errorResponses([400, 401, 403, 404, 422]),
    },
  },
  {
    method: 'delete',
    path: VERSION_PATH,
    tags: TAGS,
    summary: 'Delete a resume version no Application links to',
    description:
      'Deletes the version and its file. A version linked to an Application answers 409; archive it instead.',
    request: { params: versionIdParams },
    responses: {
      204: { description: 'The version and its file are deleted' },
      ...errorResponses([401, 403, 404, 409, 422, 503]),
    },
  },
  {
    method: 'post',
    path: `${VERSION_PATH}/activate`,
    tags: TAGS,
    summary: 'Make a resume version the active one',
    description: 'Sets activeResumeVersionId in the settings. An archived version answers 409.',
    request: { params: versionIdParams },
    responses: { 204: { description: 'The version is active' }, ...ownedConflictErrors },
  },
  {
    method: 'get',
    path: `${VERSION_PATH}/download`,
    tags: TAGS,
    summary: 'A presigned URL to download the file of a resume version',
    description: `The URL is valid ${DOWNLOAD_TTL_MINUTES} minutes and serves the file with its stored type and original filename.`,
    request: { params: versionIdParams },
    responses: {
      200: {
        description: 'The download URL',
        content: jsonContent(resumeDownloadSchema, DOWNLOAD),
      },
      ...ownedErrors,
    },
  },
  {
    method: 'patch',
    path: '/applications/{id}/resume-version',
    tags: ['applications'],
    summary: 'Link an Application to a resume version',
    description:
      "Any version of the signed-in user, archived ones included. A new link adds a resume_attached timeline row and a resume.attached event in one transaction; the version already linked writes nothing. Another user's Application or version answers 404.",
    request: {
      params: applicationIdParams,
      body: {
        required: true,
        description: 'The resume version to link.',
        content: jsonContent(relinkResumeVersionInputSchema, RELINK_INPUT),
      },
    },
    responses: {
      204: { description: 'The Application links the version' },
      ...errorResponses([400, 401, 403, 404, 422]),
    },
  },
];
