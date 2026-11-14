'use client';

import type { ApplicationResponse, FollowupRequest, FollowupRequestInput } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseFormSetError } from 'react-hook-form';

import { ApiError, applyFieldErrors, useSubmitKey } from '@/shared/api';

import { generateFollowup } from '../api/generate-followup';
import { invalidateFollowup } from './invalidate-followup';

export type GenerateFollowupOptions = Readonly<{
  applicationId: ApplicationResponse['id'];
  setError: UseFormSetError<FollowupRequestInput>;
}>;

export type GenerateFollowup = Readonly<{
  isPending: boolean;
  refused: boolean;
  generate: (body: FollowupRequest, onAccepted: () => void) => void;
  reset: () => void;
}>;

const REQUEST_FIELDS = ['tone', 'language', 'hint'] as const;

function isInvalid(error: Error | null): error is ApiError {
  return error instanceof ApiError && error.status === 422;
}

export function useGenerateFollowup({
  applicationId,
  setError,
}: GenerateFollowupOptions): GenerateFollowup {
  const queryClient = useQueryClient();
  const submitKey = useSubmitKey();
  const mutation = useMutation({
    mutationFn: (body: FollowupRequest) =>
      generateFollowup({ applicationId, body, idempotencyKey: submitKey.keyFor(body) }),
    onSuccess: () => {
      submitKey.reset();
      return invalidateFollowup({ queryClient, applicationId });
    },
    onError: (error) => {
      if (isInvalid(error)) applyFieldErrors({ error, fields: REQUEST_FIELDS, setError });
    },
  });
  return {
    isPending: mutation.isPending,
    refused: mutation.isError && !isInvalid(mutation.error),
    generate: (body, onAccepted) => {
      mutation.mutate(body, { onSuccess: onAccepted });
    },
    reset: () => {
      mutation.reset();
    },
  };
}
