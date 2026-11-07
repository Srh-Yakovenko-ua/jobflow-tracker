import { useQueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { applicationKeys } from '@/entities/application';
import { resumeKeys } from '@/entities/resume';
import { userKeys } from '@/entities/user';
import { deleteAiResultsRoute } from '@/test/ai-results-fixtures';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { ME_RESPONSE } from '@/test/session-fixtures';

import { useDeleteAiResultsMutation } from './use-delete-ai-results-mutation';

const CACHED = [
  { queryKey: applicationKeys.detail(ACME_APPLICATION.id), data: ACME_APPLICATION },
  { queryKey: resumeKeys.list(), data: [] },
  { queryKey: userKeys.me(), data: ME_RESPONSE },
];

describe('useDeleteAiResultsMutation', () => {
  it('sends one DELETE and marks the applications and the resumes stale, so scores and profiles load again', async () => {
    const route = deleteAiResultsRoute();
    server.use(route.handler);
    const { result } = renderHookInApp(() => ({
      mutation: useDeleteAiResultsMutation(),
      queryClient: useQueryClient(),
    }));
    act(() => {
      for (const { queryKey, data } of CACHED)
        result.current.queryClient.setQueryData(queryKey, data);
    });

    act(() => {
      result.current.mutation.mutate();
    });

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true);
    });
    expect(route.sent).toEqual(['DELETE']);
    expect(
      CACHED.map(
        ({ queryKey }) => result.current.queryClient.getQueryState(queryKey)?.isInvalidated,
      ),
    ).toEqual([true, true, false]);
  });
});
