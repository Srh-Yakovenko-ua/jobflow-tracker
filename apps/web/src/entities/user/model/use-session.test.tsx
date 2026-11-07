import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setAccessToken } from '@/shared/api';
import { SESSION_COOKIE } from '@/shared/lib/session-cookie';
import { apiUrl, recordSentRequests, SESSION_TOKENS } from '@/test/api-handlers';
import { fixtureIdOf } from '@/test/board-fixtures';
import { replace } from '@/test/navigation';
import { refuseStorage } from '@/test/refusing-storage';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { ME_RESPONSE, meRoute } from '@/test/session-fixtures';

import { recentApplicationsKeyOf } from '../lib/recent-applications-key';
import { useSession } from './use-session';

vi.mock('next/navigation', () => import('@/test/navigation'));

const LOGOUT_ALL_URL = apiUrl('/auth/logout-all');

const MY_RECENTS = recentApplicationsKeyOf(ME_RESPONSE.user.id);

const OTHER_RECENTS = recentApplicationsKeyOf(fixtureIdOf(901));

const STORED_RECENTS = '[{"id":"1","company":"Roku","position":"Mobile Engineer"}]';

function loggedOut() {
  return new HttpResponse(null, { status: 204 });
}

async function renderSignedIn() {
  setAccessToken(SESSION_TOKENS.fresh);
  server.use(
    meRoute(),
    http.post(apiUrl('/auth/logout'), loggedOut),
    http.post(LOGOUT_ALL_URL, loggedOut),
  );
  const { result } = renderHookInApp(useSession);
  await waitFor(() => {
    expect(result.current.user?.email).toBe('andrii@example.com');
  });
  return result;
}

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockClear();
  localStorage.clear();
});

describe('useSession logoutEverywhere', () => {
  it('ends every session on the API, forgets the token, lands on login and asks nothing more', async () => {
    const sentRequests = recordSentRequests();
    const result = await renderSignedIn();

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

describe('useSession logout', () => {
  it.each(['logout', 'logoutEverywhere'] as const)(
    '%s forgets the recent applications of this user and keeps those of another account',
    async (leave) => {
      localStorage.setItem(MY_RECENTS, STORED_RECENTS);
      localStorage.setItem(OTHER_RECENTS, STORED_RECENTS);
      const result = await renderSignedIn();

      act(() => {
        result.current[leave]();
      });

      await waitFor(() => {
        expect(localStorage.getItem(MY_RECENTS)).toBeNull();
      });
      expect(localStorage.getItem(OTHER_RECENTS)).toBe(STORED_RECENTS);
    },
  );

  it('still lands on login when the storage refuses to forget, and logs it once', async () => {
    const warn = refuseStorage();
    const result = await renderSignedIn();

    act(() => {
      result.current.logout();
    });

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
