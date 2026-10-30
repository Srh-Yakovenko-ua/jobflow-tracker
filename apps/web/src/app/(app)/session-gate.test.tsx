import { useMutation } from '@tanstack/react-query';
import { act, screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { userKeys } from '@/entities/user';
import { API_CLIENT_LIMITS, apiClient, clearAccessToken, setAccessToken } from '@/shared/api';
import {
  freshSuggestionsRoute,
  OUTAGES,
  recordSentRequests,
  REFRESH_URL,
  refreshRoute,
  SESSION_TOKENS,
  SUGGESTIONS_REQUEST,
  suggestionsSession,
} from '@/test/api-handlers';
import { replace } from '@/test/navigation';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { ShellSkeleton } from '@/widgets/app-shell';

import { SessionGate } from './session-gate';

vi.mock('next/navigation', () => import('@/test/navigation'));

const PAGE = 'signed-in page';

const REQUEST_STATUS = 'request status';

const STARTUP_ATTEMPTS = 2;

const RETRY_PAUSE_MS = 1000;

const LEAVE = 'leave the signed-in pages';

function PageWithRequest() {
  const load = useMutation({ mutationFn: () => apiClient.request(SUGGESTIONS_REQUEST) });
  return (
    <>
      <button
        type="button"
        onClick={() => {
          load.mutate();
        }}
      >
        {PAGE}
      </button>
      <output aria-label={REQUEST_STATUS}>{load.status}</output>
    </>
  );
}

function LeavableGate() {
  const [inside, setInside] = useState(true);
  return (
    <>
      {inside && (
        <SessionGate fallback={null}>
          <button
            type="button"
            onClick={() => {
              setInside(false);
            }}
          >
            {LEAVE}
          </button>
        </SessionGate>
      )}
      <QueryProbe queryKey={userKeys.session()} />
    </>
  );
}

function renderGate() {
  return renderInApp(
    <SessionGate fallback={<ShellSkeleton initial={{ collapsed: false }} />}>
      <PageWithRequest />
    </SessionGate>,
  );
}

async function clickThroughExpiredToken() {
  setAccessToken(SESSION_TOKENS.expired);
  const user = renderGate();
  await user.click(await screen.findByRole('button', { name: PAGE }));
}

afterEach(() => {
  clearAccessToken();
  replace.mockClear();
  history.replaceState(null, '', '/');
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SessionGate on app start', () => {
  it('shows the full page skeleton while the cookie refresh runs, then the page', async () => {
    server.use(refreshRoute({ token: SESSION_TOKENS.fresh }));
    renderGate();

    expect(screen.getByRole('status').textContent).toBe('Завантаження…');
    expect(await screen.findByRole('button', { name: PAGE })).toBeDefined();
    expect(screen.queryByText('Завантаження…')).toBeNull();
  });

  it('a refused refresh sends the visitor to login with the requested page as next', async () => {
    history.replaceState(null, '', '/applications/123');
    renderGate();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login?next=%2Fapplications%2F123');
    });
    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(OUTAGES)(
    'a refresh that $name shows the load failed panel, whose retry opens the page with no logout',
    async ({ reply }) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
      server.use(http.post(REFRESH_URL, reply));
      const user = renderGate();
      await act(() =>
        vi.advanceTimersByTimeAsync(
          STARTUP_ATTEMPTS * API_CLIENT_LIMITS.requestTimeoutMs + RETRY_PAUSE_MS,
        ),
      );

      const panel = await screen.findByRole('alert');
      server.use(refreshRoute({ token: SESSION_TOKENS.fresh }));
      await user.click(within(panel).getByRole('button', { name: 'Спробувати ще раз' }));

      expect(await screen.findByRole('button', { name: PAGE })).toBeDefined();
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it('a held access token opens the page without a refresh request', async () => {
    setAccessToken(SESSION_TOKENS.fresh);
    const sentRequests = recordSentRequests();
    renderGate();

    expect(await screen.findByRole('button', { name: PAGE })).toBeDefined();
    expect(sentRequests()).toEqual([]);
  });
});

describe('SessionGate mid-session', () => {
  it('after 15 idle minutes the next click refreshes once and its request succeeds with no logout', async () => {
    const onRefresh = vi.fn();
    server.use(...suggestionsSession({ onCall: onRefresh }));

    await clickThroughExpiredToken();

    await waitFor(() => {
      expect(screen.getByLabelText(REQUEST_STATUS).textContent).toBe('success');
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it('a refused refresh sends to login with the current path and query as next', async () => {
    history.replaceState(null, '', '/applications/123?tab=notes');
    server.use(freshSuggestionsRoute());

    await clickThroughExpiredToken();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login?next=%2Fapplications%2F123%3Ftab%3Dnotes');
    });
  });
});

describe('SessionGate on leaving', () => {
  it('leaving the signed-in pages, as a logout does, forgets what they cached', async () => {
    setAccessToken(SESSION_TOKENS.fresh);
    const user = renderInApp(<LeavableGate />);

    await user.click(await screen.findByRole('button', { name: LEAVE }));

    await waitForQuery({ queryKey: userKeys.session(), status: 'absent' });
  });
});
