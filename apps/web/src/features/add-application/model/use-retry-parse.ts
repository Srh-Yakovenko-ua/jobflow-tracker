'use client';

import { type AiJobAccepted, aiJobAcceptedSchema, type ApplicationResponse } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { applicationKeys, retryLimitToast } from '@/entities/application';
import { apiClient, ApiError, HTTP_STATUS } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

export type RetryParseOptions = Readonly<{
  applicationId: ApplicationResponse['id'];
  actions: { onRetried: (jobId: AiJobAccepted['jobId']) => void };
}>;

export type RetryParse = Readonly<{ isPending: boolean; retry: () => void }>;

export function useRetryParse({ applicationId, actions }: RetryParseOptions): RetryParse {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      apiClient.request({
        path: `/capture/drafts/${applicationId}/retry`,
        method: 'POST',
        schema: aiJobAcceptedSchema,
      }),
    onSuccess: ({ jobId }) => {
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      actions.onRetried(jobId);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === HTTP_STATUS.tooManyRequests) {
        showErrorToast(retryLimitToast(error.retryAfterSeconds));
        return;
      }
      showErrorToast(uk.errors.saveFailed);
      void queryClient.invalidateQueries({ queryKey: applicationKeys.detail(applicationId) });
    },
  });
  return {
    isPending: mutation.isPending,
    retry: () => {
      mutation.mutate();
    },
  };
}
