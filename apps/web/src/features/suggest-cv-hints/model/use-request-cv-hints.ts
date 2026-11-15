'use client';

import type { ApplicationResponse } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { applicationKeys } from '@/entities/application';
import { useSubmitKey } from '@/shared/api';

import { requestCvHints } from '../api/request-cv-hints';

export type RequestedCvHints = Readonly<{
  isPending: boolean;
  refused: boolean;
  request: () => void;
}>;

const SUBMIT = { kind: 'cv-hints' } as const;

export function useRequestCvHints(applicationId: ApplicationResponse['id']): RequestedCvHints {
  const queryClient = useQueryClient();
  const submitKey = useSubmitKey();
  const mutation = useMutation({
    mutationFn: () => requestCvHints({ applicationId, idempotencyKey: submitKey.keyFor(SUBMIT) }),
    onSuccess: () => {
      submitKey.reset();
      return queryClient.invalidateQueries({ queryKey: applicationKeys.cvHints(applicationId) });
    },
  });
  return {
    isPending: mutation.isPending,
    refused: mutation.isError,
    request: () => {
      mutation.mutate();
    },
  };
}
