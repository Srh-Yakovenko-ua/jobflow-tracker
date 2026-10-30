import { act, waitFor } from '@testing-library/react';
import { http } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { userKeys } from '@/entities/user';
import { API_CLIENT_LIMITS } from '@/shared/api';
import {
  errorReply,
  type Outage,
  OUTAGES,
  REFRESH_REFUSED,
  REFRESH_URL,
  refreshRoute,
  SESSION_TOKENS,
} from '@/test/api-handlers';
import { renderAuthForm, resetSignIn } from '@/test/auth-form';
import { replace } from '@/test/navigation';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { server } from '@/test/server';

vi.mock('next/navigation', () => import('@/test/navigation'));

const REQUESTED = '/applications/123';

const NO_SESSION: readonly Outage[] = [
  { name: 'answers 401', reply: () => errorReply(REFRESH_REFUSED), settled: 'error' },
  ...OUTAGES,
];

describe('the sign-in form with a refresh cookie', () => {
  afterEach(() => {
    resetSignIn();
    vi.useRealTimers();
  });

  it('a valid cookie sends the visitor on to the requested page, the form usable meanwhile', async () => {
    server.use(refreshRoute({ token: SESSION_TOKENS.fresh }));
    const form = renderAuthForm({ mode: 'login', returnTo: REQUESTED });

    expect(form.submit).toHaveProperty('disabled', false);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(REQUESTED);
    });
  });

  it.each(NO_SESSION)('a refresh that $name keeps the form and goes nowhere', async ({ reply }) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
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
});
