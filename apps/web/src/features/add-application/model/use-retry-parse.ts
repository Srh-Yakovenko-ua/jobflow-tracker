'use client';

import {
  type ApplicationResponse,
  type CaptureRetryResponse,
  captureRetryResponseSchema,
} from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { applicationKeys } from '@/entities/application';
import { apiClient, ApiError } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

import { retryLimitToast } from './add-error-toast';

export type RetryParseOptions = Readonly<{
  applicationId: ApplicationResponse['id'];
  actions: { onRetried: (jobId: CaptureRetryResponse['jobId']) => void };
}>;

export type RetryParse = Readonly<{ isPending: boolean; retry: () => void }>;

export function useRetryParse({ applicationId, actions }: RetryParseOptions): RetryParse {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      apiClient.request({
        path: `/capture/drafts/${applicationId}/retry`,
        method: 'POST',
        schema: captureRetryResponseSchema,
      }),
    onSuccess: ({ jobId }) => {
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      actions.onRetried(jobId);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 429) {
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
