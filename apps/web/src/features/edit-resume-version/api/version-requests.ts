import {
  type ResumeDownload,
  resumeDownloadSchema,
  type ResumeVersion,
  resumeVersionSchema,
  type UpdateResumeVersionInput,
} from '@jobflow/shared';

import { resumeVersionPath } from '@/entities/resume';
import { apiClient } from '@/shared/api';

export type UpdateVersionRequest = Readonly<{
  id: ResumeVersion['id'];
  patch: UpdateResumeVersionInput;
}>;

export function updateResumeVersion({ id, patch }: UpdateVersionRequest): Promise<ResumeVersion> {
  return apiClient.request({
    path: resumeVersionPath(id),
    method: 'PATCH',
    body: patch,
    schema: resumeVersionSchema,
  });
}

export function downloadResumeVersion(id: ResumeVersion['id']): Promise<ResumeDownload> {
  return apiClient.request({
    path: `${resumeVersionPath(id)}/download`,
    schema: resumeDownloadSchema,
  });
}
