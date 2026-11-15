'use client';

import type { ApplicationResponse } from '@jobflow/shared';

import { useApplicationAiRequest } from '@/entities/application';

export type RequestedCvHints = Readonly<{
  isPending: boolean;
  refused: boolean;
  request: () => void;
}>;

export function useRequestCvHints(applicationId: ApplicationResponse['id']): RequestedCvHints {
  const mutation = useApplicationAiRequest({ applicationId, segment: 'cv-hints' });
  return {
    isPending: mutation.isPending,
    refused: mutation.isError,
    request: () => {
      mutation.mutate();
    },
  };
}
