import { type ResumeVersion, resumeVersionListResponseSchema } from '@jobflow/shared';
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { apiClient } from '@/shared/api';

import { resumeKeys } from '../model/keys';

export const RESUME_VERSIONS_PATH = '/resumes/versions';

export function resumeVersionPath(id: ResumeVersion['id']): string {
  return `${RESUME_VERSIONS_PATH}/${id}`;
}

export function resumeVersionsQueryOptions() {
  return queryOptions({
    queryKey: resumeKeys.list(),
    queryFn: ({ signal }) =>
      apiClient.request({
        path: RESUME_VERSIONS_PATH,
        schema: resumeVersionListResponseSchema,
        signal,
      }),
    refetchOnWindowFocus: true,
  });
}

export function activateResumeVersion(id: ResumeVersion['id']): Promise<void> {
  return apiClient.request({
    path: `${resumeVersionPath(id)}/activate`,
    method: 'POST',
    schema: z.void(),
  });
}
