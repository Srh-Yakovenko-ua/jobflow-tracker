'use client';

import type { ApplicationResponse } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useSubmitKey } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';
import { showToast } from '@/shared/ui/toast';

import { markFollowupSent } from '../api/mark-followup-sent';
import { forgetDraftEdit } from '../lib/draft-edits';
import { invalidateFollowup } from './invalidate-followup';

export type MarkFollowupSent = Readonly<{
  isPending: boolean;
  isSuccess: boolean;
  mark: () => void;
  reset: () => void;
}>;

export function useMarkFollowupSent(applicationId: ApplicationResponse['id']): MarkFollowupSent {
  const queryClient = useQueryClient();
  const submitKey = useSubmitKey();
  const mutation = useMutation({
    mutationFn: () =>
      markFollowupSent({ applicationId, idempotencyKey: submitKey.keyFor({ applicationId }) }),
    onSuccess: async () => {
      submitKey.reset();
      forgetDraftEdit(applicationId);
      showToast({ tone: 'success', title: uk.followup.sent });
      await invalidateFollowup({ queryClient, applicationId });
    },
    onError: () => {
      showErrorToast(uk.errors.saveFailed);
    },
  });
  return {
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    mark: () => {
      mutation.mutate();
    },
    reset: mutation.reset,
  };
}
