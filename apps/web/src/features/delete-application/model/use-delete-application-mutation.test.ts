import { useQueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { scheduledEventKeys } from '@/entities/scheduled-event';
import { userKeys } from '@/entities/user';
import { ACME_APPLICATION, deleteRoute } from '@/test/application-fixtures';
import { KYIV_WEEK } from '@/test/calendar-fixtures';
import { renderHookInApp } from '@/test/render-in-app';
import { buildRhythm } from '@/test/rhythm-fixtures';
import { server } from '@/test/server';
import { settleMutation } from '@/test/settle-mutation';

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

  it('a deleted card drops out of the rhythm widget count', async () => {
    server.use(deleteRoute().handler);

    const { status, invalidated } = await settleMutation({
      useMutation: () => {
        const mutation = useDeleteApplicationMutation();
        return {
          mutate: () => {
            mutation.mutate(ACME_APPLICATION.id);
          },
          status: mutation.status,
        };
      },
      cached: [{ queryKey: userKeys.rhythm(), data: buildRhythm() }],
    });

    expect(status).toBe('success');
    expect(invalidated).toEqual([true]);
  });
});
