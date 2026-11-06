import { useQueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { scheduledEventKeys } from '@/entities/scheduled-event';
import { ACME_APPLICATION, deleteRoute } from '@/test/application-fixtures';
import { KYIV_WEEK } from '@/test/calendar-fixtures';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { useDeleteApplicationMutation } from './use-delete-application-mutation';

describe('useDeleteApplicationMutation', () => {
  it('marks every calendar range stale once the card is deleted, so its events leave the grid', async () => {
    server.use(deleteRoute().handler);
    const { result } = renderHookInApp(() => ({
      mutation: useDeleteApplicationMutation(),
      queryClient: useQueryClient(),
    }));
    const calendarKey = scheduledEventKeys.calendar(KYIV_WEEK);
    act(() => {
      result.current.queryClient.setQueryData(calendarKey, { items: [] });
    });

    act(() => {
      result.current.mutation.mutate(ACME_APPLICATION.id);
    });

    await waitFor(() => {
      expect(result.current.mutation.isSuccess).toBe(true);
    });
    expect(result.current.queryClient.getQueryState(calendarKey)?.isInvalidated).toBe(true);
  });
});
