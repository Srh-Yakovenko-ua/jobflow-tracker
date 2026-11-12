import type { Application, RelinkResumeVersionInput } from '@jobflow/shared';
import { z } from 'zod';

import { apiClient } from '@/shared/api';

export type RelinkRequest = RelinkResumeVersionInput &
  Readonly<{ applicationId: Application['id'] }>;

export function relinkResumeVersion({ applicationId, resumeVersionId }: RelinkRequest) {
  const body: RelinkResumeVersionInput = { resumeVersionId };
  return apiClient.request({
    path: `/applications/${applicationId}/resume-version`,
    method: 'PATCH',
    body,
    schema: z.void(),
  });
}
