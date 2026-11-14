'use client';

import type { Summary } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { planKeys } from '@/entities/plan';
import { summaryKeys } from '@/entities/summary';
import { useSubmitKey } from '@/shared/api';

import { saveSummaryPlan } from '../api/save-summary-plan';

export type SaveSummaryPlan = Readonly<{
  saved: boolean;
  isPending: boolean;
  failed: boolean;
  save: () => void;
}>;

export function useSaveSummaryPlan(summary: Summary): SaveSummaryPlan {
  const queryClient = useQueryClient();
  const submitKey = useSubmitKey();
  const { aiJobId } = summary;
  const mutation = useMutation({
    mutationFn: () => saveSummaryPlan({ aiJobId, idempotencyKey: submitKey.keyFor(aiJobId) }),
    onSuccess: () => {
      submitKey.reset();
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: planKeys.all }),
        queryClient.invalidateQueries({ queryKey: summaryKeys.all }),
      ]);
    },
  });
  return {
    saved: summary.planId !== null || mutation.isSuccess,
    isPending: mutation.isPending,
    failed: mutation.isError,
    save: () => {
      mutation.mutate();
    },
  };
}
