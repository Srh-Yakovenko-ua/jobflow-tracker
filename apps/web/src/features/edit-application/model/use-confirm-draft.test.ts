import { useQueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { applicationKeys, timelineKeys } from '@/entities/application';
import { errorReply } from '@/test/api-handlers';
import { confirmRoute, REVIEW_DRAFT, updateRoute } from '@/test/application-fixtures';
import type { MoveRouteOptions } from '@/test/board-fixtures';
import { latch } from '@/test/latch';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { useConfirmDraft } from './use-confirm-draft';

function renderConfirmDraft(onConfirmed: () => void) {
  return renderHookInApp(() => ({
    draft: useConfirmDraft({
      applicationId: REVIEW_DRAFT.id,
      setError: () => undefined,
      actions: { onConfirmed },
    }),
    queryClient: useQueryClient(),
  }));
}

type StaleStep = {
  step: string;
  update: MoveRouteOptions;
  confirm: MoveRouteOptions;
  confirmsSent: readonly string[];
};

const TABLE_KEY = applicationKeys.table({});

const TIMELINE_KEY = timelineKeys.detail(REVIEW_DRAFT.id);

const CONFLICT: MoveRouteOptions = {
  reply: () => errorReply({ status: 409, type: 'conflict' }),
};

const STALE_STEPS: readonly StaleStep[] = [
  { step: 'PATCH', update: CONFLICT, confirm: {}, confirmsSent: [] },
  { step: 'confirm', update: {}, confirm: CONFLICT, confirmsSent: [REVIEW_DRAFT.id] },
];

describe('useConfirmDraft', () => {
  it.each(STALE_STEPS)(
    'a 409 from the $step step refreshes the lists and the timeline and reports nothing confirmed',
    async ({ update, confirm, confirmsSent }) => {
      const confirms = confirmRoute(confirm);
      server.use(updateRoute({ application: REVIEW_DRAFT, ...update }).handler, confirms.handler);
      const onConfirmed = vi.fn<() => void>();
      const { result } = renderConfirmDraft(onConfirmed);
      act(() => {
        result.current.queryClient.setQueryData(TABLE_KEY, []);
        result.current.queryClient.setQueryData(TIMELINE_KEY, []);
      });

      act(() => {
        result.current.draft.save({ company: 'Acme Labs' });
      });

      await waitFor(() => {
        expect(result.current.queryClient.getQueryState(TABLE_KEY)?.isInvalidated).toBe(true);
      });
      expect(result.current.queryClient.getQueryState(TIMELINE_KEY)?.isInvalidated).toBe(true);
      expect(confirms.sent).toEqual(confirmsSent);
      expect(onConfirmed).not.toHaveBeenCalled();
    },
  );

  it('a late draft confirm leaves the newer page open', async () => {
    const held = latch();
    const confirms = confirmRoute({ latch: held });
    server.use(confirms.handler);
    const onConfirmed = vi.fn<() => void>();
    const { result, unmount } = renderConfirmDraft(onConfirmed);
    const { queryClient } = result.current;
    act(() => {
      queryClient.setQueryData(TABLE_KEY, []);
    });
    act(() => {
      result.current.draft.save(null);
    });
    await waitFor(() => {
      expect(confirms.sent).toEqual([REVIEW_DRAFT.id]);
    });

    unmount();
    held.release();

    await waitFor(() => {
      expect(queryClient.getQueryState(TABLE_KEY)?.isInvalidated).toBe(true);
    });
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});
