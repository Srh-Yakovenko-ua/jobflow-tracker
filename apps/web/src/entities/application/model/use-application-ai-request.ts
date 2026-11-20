'use client';

import type { ApplicationResponse } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useSubmitKey } from '@/shared/api';

import { type ApplicationAiJobSegment, requestApplicationAiJob } from '../api/ai-job-request';
import { applicationKeys } from './keys';

export type ApplicationAiRequestInput = Readonly<{
  applicationId: ApplicationResponse['id'];
  segment: ApplicationAiJobSegment;
}>;

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
      return queryClient.invalidateQueries({
        queryKey: applicationKeys.ai(applicationId, segment),
      });
    },
    onError: () => undefined,
  });
}
