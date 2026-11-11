import { focusManager, onlineManager } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { http } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { userKeys } from '@/entities/user';
import { API_CLIENT_LIMITS } from '@/shared/api';
import { SESSION_COOKIE, writeSessionCookie } from '@/shared/lib/session-cookie';
import {
  errorReply,
  type Outage,
  OUTAGES,
  recordSentRequests,
  REFRESH_REFUSED,
  REFRESH_URL,
  refreshRoute,
  refusedRefreshRoute,
  SESSION_TOKENS,
} from '@/test/api-handlers';
import { renderAuthForm, resetSignIn } from '@/test/auth-form';
import { fakeTimeouts } from '@/test/fake-timeouts';
import { replace } from '@/test/navigation';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { InApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import type { AuthMode } from '../model/auth-modes';
import { AuthForm } from './auth-form';

vi.mock('next/navigation', () => import('@/test/navigation'));

type LoginPage = Readonly<{ reopen: (mode: AuthMode) => Promise<void> }>;

type Trigger = Readonly<{ name: string; run: (page: LoginPage) => unknown }>;

const REQUESTED = '/applications/123';

const PAGE_GAP_MS = 1_000;

const NO_SESSION: readonly Outage[] = [
  { name: 'answers 401', reply: () => errorReply(REFRESH_REFUSED), settled: 'error' },
  ...OUTAGES,
];

const TRIGGERS: readonly Trigger[] = [
  {
    name: 'the window loses focus and gets it back',
    run: () => {
      act(() => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });
    },
  },
  {
    name: 'the network drops and comes back',
    run: () => {
      act(() => {
        onlineManager.setOnline(false);
        onlineManager.setOnline(true);
      });
    },
  },
  {
    name: 'the visitor switches to register and back',
    run: async (page: LoginPage) => {
      await page.reopen('register');
      await page.reopen('login');
    },
  },
];

function screenWith(mode?: AuthMode) {
  return (
    <InApp>
      <main>
        {mode !== undefined && <AuthForm mode={mode} returnTo={REQUESTED} />}
        <QueryProbe queryKey={userKeys.cookieSession()} />
      </main>
    </InApp>
  );
}

function renderLoginPage(): LoginPage {
  const { rerender } = render(screenWith('login'));
  return {
    reopen: async (mode) => {
      rerender(screenWith());
      await act(() => vi.advanceTimersByTimeAsync(PAGE_GAP_MS));
      rerender(screenWith(mode));
    },
  };
}

function refreshesSent(sentRequests: ReturnType<typeof recordSentRequests>) {
  return sentRequests().filter(({ url, method }) => url === REFRESH_URL && method === 'POST');
}

afterEach(() => {
  resetSignIn();
  history.replaceState(null, '', '/');
  vi.useRealTimers();
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe('the sign-in form with a refresh cookie', () => {
  beforeEach(writeSessionCookie);

  it.each([
    ['/login', REQUESTED],
    ['/login#history', `${REQUESTED}#history`],
  ])(
    'a valid cookie on %s sends the visitor on to the requested page, the form usable meanwhile',
    async (loginPage, landing) => {
      history.replaceState(null, '', loginPage);
      server.use(refreshRoute({ token: SESSION_TOKENS.fresh }));
      const form = renderAuthForm({ mode: 'login', returnTo: REQUESTED });

      expect(form.submit).toHaveProperty('disabled', false);
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith(landing);
      });
    },
  );

  it.each(NO_SESSION)('a refresh that $name keeps the form and goes nowhere', async ({ reply }) => {
    fakeTimeouts();
    server.use(http.post(REFRESH_URL, reply));
    const form = renderAuthForm(
      { mode: 'login', returnTo: REQUESTED },
      <QueryProbe queryKey={userKeys.cookieSession()} />,
    );

    await act(() => vi.advanceTimersByTimeAsync(API_CLIENT_LIMITS.requestTimeoutMs));

    await waitForQuery({ queryKey: userKeys.cookieSession(), status: 'error' });
    expect(replace).not.toHaveBeenCalled();
    expect(form.submit).toHaveProperty('disabled', false);
  });

  it('a refused cookie keeps the form and clears the session marker', async () => {
    server.use(refusedRefreshRoute());
    const form = renderAuthForm(
      { mode: 'login', returnTo: REQUESTED },
      <QueryProbe queryKey={userKeys.cookieSession()} />,
    );

    await waitForQuery({ queryKey: userKeys.cookieSession(), status: 'error' });

    expect(document.cookie).not.toContain(`${SESSION_COOKIE}=1`);
    expect(replace).not.toHaveBeenCalled();
    expect(form.submit).toHaveProperty('disabled', false);
  });
});

describe('the sign-in form for a new visitor without the session marker', () => {
  beforeEach(fakeTimeouts);

  it.each<AuthMode>(['login', 'register'])(
    'the %s form sends no refresh and stays usable',
    async (mode) => {
      const sentRequests = recordSentRequests();
      const form = renderAuthForm({ mode, returnTo: REQUESTED });

      await act(() => vi.advanceTimersByTimeAsync(API_CLIENT_LIMITS.requestTimeoutMs));

      expect(refreshesSent(sentRequests)).toHaveLength(0);
      expect(replace).not.toHaveBeenCalled();
      expect(form.submit).toHaveProperty('disabled', false);
    },
  );
});

describe('the sign-in form for a signed-out visitor', () => {
  beforeEach(fakeTimeouts);
  beforeEach(writeSessionCookie);

  it.each(TRIGGERS)('checks the session once on a server error when $name', async ({ run }) => {
    server.use(http.post(REFRESH_URL, () => errorReply({ status: 500, type: 'internal_error' })));
    const sentRequests = recordSentRequests();
    const page = renderLoginPage();
    await waitForQuery({ queryKey: userKeys.cookieSession(), status: 'error' });

    await run(page);
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(document.cookie).toContain(`${SESSION_COOKIE}=1`);
    expect(refreshesSent(sentRequests)).toHaveLength(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it('after a valid cookie sent the visitor on, the next visit checks again and stays on a refused cookie', async () => {
    server.use(refreshRoute({ token: SESSION_TOKENS.fresh }));
    const sentRequests = recordSentRequests();
    const page = renderLoginPage();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(REQUESTED);
    });

    server.use(refusedRefreshRoute());
    await page.reopen('login');
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(refreshesSent(sentRequests)).toHaveLength(2);
    await waitForQuery({ queryKey: userKeys.cookieSession(), status: 'error' });
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
