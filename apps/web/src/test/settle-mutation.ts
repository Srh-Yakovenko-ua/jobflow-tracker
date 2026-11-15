import { type MutationStatus, type QueryKey, useQueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { expect } from 'vitest';

import { renderHookInApp } from './render-in-app';

export type CachedQuery = Readonly<{ queryKey: QueryKey; data: unknown }>;

export type SettleMutationInput = Readonly<{
  useMutation: () => { mutate: () => void; status: MutationStatus };
  cached: readonly CachedQuery[];
}>;

export type SettledMutation = Readonly<{
  status: MutationStatus;
  invalidated: readonly (boolean | undefined)[];
}>;

const SETTLED: readonly MutationStatus[] = ['success', 'error'];

export async function settleMutation({
  useMutation,
  cached,
}: SettleMutationInput): Promise<SettledMutation> {
  const { result } = renderHookInApp(() => ({
    mutation: useMutation(),
    queryClient: useQueryClient(),
  }));
  act(() => {
    for (const { queryKey, data } of cached)
      result.current.queryClient.setQueryData(queryKey, data);
  });

  act(() => {
    result.current.mutation.mutate();
  });

  await waitFor(() => {
    expect(SETTLED).toContain(result.current.mutation.status);
  });
  return {
    status: result.current.mutation.status,
    invalidated: cached.map(
      ({ queryKey }) => result.current.queryClient.getQueryState(queryKey)?.isInvalidated,
    ),
  };
}
