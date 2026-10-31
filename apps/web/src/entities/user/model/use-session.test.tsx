import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setAccessToken } from '@/shared/api';
import { SESSION_COOKIE } from '@/shared/lib/session-cookie';
import { apiUrl, recordSentRequests, SESSION_TOKENS } from '@/test/api-handlers';
import { replace } from '@/test/navigation';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { useSession } from './use-session';

vi.mock('next/navigation', () => import('@/test/navigation'));

const LOGOUT_ALL_URL = apiUrl('/auth/logout-all');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSession logoutEverywhere', () => {
  it('ends every session on the API, forgets the token, lands on login and asks nothing more', async () => {
    setAccessToken(SESSION_TOKENS.fresh);
    server.use(
      meRoute(),
      http.post(LOGOUT_ALL_URL, () => new HttpResponse(null, { status: 204 })),
    );
    const sentRequests = recordSentRequests();
    const { result } = renderHookInApp(useSession);
    await waitFor(() => {
      expect(result.current.user?.email).toBe('andrii@example.com');
    });

    act(() => {
      result.current.logoutEverywhere();
    });

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
    expect(sentRequests().map(({ url, method }) => [method ?? 'GET', url])).toEqual([
      ['GET', apiUrl('/auth/me')],
      ['POST', LOGOUT_ALL_URL],
    ]);
    expect(document.cookie).not.toContain(`${SESSION_COOKIE}=1`);
  });
});
