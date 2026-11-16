import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACME_APPLICATION } from '@/test/application-fixtures';
import { fixtureIdOf } from '@/test/board-fixtures';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { ME_RESPONSE, meRoute } from '@/test/session-fixtures';

import { useAskedTopics } from './use-asked-topics';

const ASKED_KEY = `jobflow.asked-topics.${ME_RESPONSE.user.id}`;

const [SKIPPED_ID, ANSWERED_ELSEWHERE_ID] = [fixtureIdOf(308), fixtureIdOf(310)];

afterEach(() => {
  localStorage.clear();
});

describe('useAskedTopics', () => {
  it('an answered id stored by another tab survives a skip here', async () => {
    server.use(meRoute());
    const { result } = renderHookInApp(() =>
      useAskedTopics({
        application: ACME_APPLICATION,
        itemId: SKIPPED_ID,
        actions: { onClosed: vi.fn() },
      }),
    );
    await waitFor(() => {
      expect(result.current.open).toBe(true);
    });
    localStorage.setItem(ASKED_KEY, JSON.stringify([ANSWERED_ELSEWHERE_ID]));

    act(() => {
      result.current.skip();
    });

    expect(JSON.parse(localStorage.getItem(ASKED_KEY) ?? '')).toEqual([
      ANSWERED_ELSEWHERE_ID,
      SKIPPED_ID,
    ]);
    expect(result.current.open).toBe(false);
  });
});
