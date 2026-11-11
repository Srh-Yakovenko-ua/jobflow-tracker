import {
  type ConfirmedResumeUpload,
  confirmedResumeUploadSchema,
  type ConfirmResumeUploadInput,
  type CreateResumeVersionInput,
  type ResumeUploadInput,
  type ResumeUploadTicket,
  resumeUploadTicketSchema,
  type ResumeVersion,
  resumeVersionSchema,
} from '@jobflow/shared';

import { RESUME_VERSIONS_PATH } from '@/entities/resume';
import { apiClient } from '@/shared/api';

const UPLOADS_PATH = '/uploads/resume';

export type ConfirmUploadInput = ConfirmResumeUploadInput & Pick<ResumeUploadTicket, 'uploadId'>;

export type CreateVersionRequest = { body: CreateResumeVersionInput; idempotencyKey: string };

export function createTicket(body: ResumeUploadInput): Promise<ResumeUploadTicket> {
  return apiClient.request({
    path: UPLOADS_PATH,
    method: 'POST',
    body,
    schema: resumeUploadTicketSchema,
  });
}

export function confirmUpload({
  uploadId,
  mime,
}: ConfirmUploadInput): Promise<ConfirmedResumeUpload> {
  return apiClient.request({
    path: `${UPLOADS_PATH}/${uploadId}/confirm`,
    method: 'POST',
    body: { mime },
    schema: confirmedResumeUploadSchema,
  });
}

export function createVersion({
  body,
  idempotencyKey,
}: CreateVersionRequest): Promise<ResumeVersion> {
  return apiClient.request({
    path: RESUME_VERSIONS_PATH,
    method: 'POST',
    body,
    idempotencyKey,
    schema: resumeVersionSchema,
  });
}
