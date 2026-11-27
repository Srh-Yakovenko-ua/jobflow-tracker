'use client';

import { MONTHLY_SUMMARY_REFUSALS } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { summaryKeys } from '@/entities/summary';
import { ApiError, useSubmitKey } from '@/shared/api';
import { uk } from '@/shared/i18n';

import { requestSummary } from '../api/request-summary';

const COPY = uk.summary.regenerate;

const REFUSALS: Readonly<Partial<Record<number, string>>> = {
  409: COPY.noSearch,
  429: COPY.rateLimited,
};

const REQUEST_BODY = 'summary';

export type RegenerateSummary = Readonly<{
  isPending: boolean;
  refusal: string | null;
  regenerate: () => void;
}>;

function refusalOf(error: Error | null): string | null {
  if (error === null) return null;
  if (!(error instanceof ApiError)) return COPY.failed;
  if (error.body.detail === MONTHLY_SUMMARY_REFUSALS.noActivity) return COPY.noActivity;
  return REFUSALS[error.status] ?? COPY.failed;
}

export function useRegenerateSummary(): RegenerateSummary {
  const queryClient = useQueryClient();
  const submitKey = useSubmitKey();
  const mutation = useMutation({
    mutationFn: () => requestSummary(submitKey.keyFor(REQUEST_BODY)),
    onSuccess: () => {
      submitKey.reset();
      return queryClient.invalidateQueries({ queryKey: summaryKeys.latest() });
    },
    onError: () => undefined,
  });
  return {
    isPending: mutation.isPending,
    refusal: refusalOf(mutation.error),
    regenerate: () => {
      mutation.mutate();
    },
  };
}
