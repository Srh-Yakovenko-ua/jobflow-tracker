'use client';

import type { ApplicationResponse } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useSubmitKey } from '@/shared/api';

import { type ApplicationAiSegment, requestApplicationAiJob } from '../api/ai-job-request';
import { applicationKeys } from './keys';

export type ApplicationAiRequestInput = Readonly<{
  applicationId: ApplicationResponse['id'];
  segment: ApplicationAiSegment;
}>;

const RESULT_KEY_OF = {
  'cv-hints': applicationKeys.cvHints,
  'interview-prep': applicationKeys.interviewPrep,
} as const satisfies Record<ApplicationAiSegment, unknown>;

export function useApplicationAiRequest({ applicationId, segment }: ApplicationAiRequestInput) {
  const queryClient = useQueryClient();
  const submitKey = useSubmitKey();
  return useMutation({
    mutationFn: () =>
      requestApplicationAiJob({
        applicationId,
        segment,
        idempotencyKey: submitKey.keyFor({ kind: segment }),
      }),
    onSuccess: () => {
      submitKey.reset();
      return queryClient.invalidateQueries({ queryKey: RESULT_KEY_OF[segment](applicationId) });
    },
    onError: () => undefined,
  });
}
