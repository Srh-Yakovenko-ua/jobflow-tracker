import type { OAuthProvider } from '@jobflow/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OUTAGES, rateLimitedReply } from '@/test/api-handlers';
import { CREDENTIALS, renderAuthForm, resetSignIn } from '@/test/auth-form';
import { axeViolations } from '@/test/dev-ui';
import { QueryProbe, waitForQuery } from '@/test/query-status';
import { server } from '@/test/server';
import { authRoute, oauthProvidersRoute } from '@/test/session-fixtures';

import type { AuthMode } from '../model/auth-modes';
import { authKeys } from '../model/keys';

vi.mock('next/navigation', () => import('@/test/navigation'));

type OAuthLinkSeen = { name: string | null; href: string | null };

type ProvidersRow = {
  enabled: readonly OAuthProvider[];
  links: readonly OAuthLinkSeen[];
  divider: boolean;
};

const MODES: readonly AuthMode[] = ['login', 'register'];

const PRIVACY =
  'Твої відгуки, заметки й резюме видно тільки тобі. Тексти вакансій ідуть у модель для розбору; заметки — ніколи.';

const PROVIDERS_KEY = authKeys.oauthProviders();

const GITHUB_LINK: OAuthLinkSeen = {
  name: 'Продовжити з GitHub',
  href: 'http://localhost:4000/api/v1/auth/oauth/github/start',
};

const PROVIDER_ROWS: readonly ProvidersRow[] = [
  { enabled: [], links: [], divider: false },
  { enabled: ['github'], links: [GITHUB_LINK], divider: true },
  {
    enabled: ['google', 'github'],
    links: [
      {
        name: 'Продовжити з Google',
        href: 'http://localhost:4000/api/v1/auth/oauth/google/start',
      },
      GITHUB_LINK,
    ],
    divider: true,
  },
];

const MODE_PROVIDER_ROWS = MODES.flatMap((mode) => PROVIDER_ROWS.map((row) => ({ mode, ...row })));

function rateLimitedLogin(headers: Record<string, string>) {
  server.use(authRoute({ path: '/auth/login', reply: () => rateLimitedReply(headers) }));
}

function oauthLinks(): OAuthLinkSeen[] {
  return screen
    .queryAllByRole('link', { name: /^Продовжити з / })
    .map((link) => ({ name: link.textContent, href: link.getAttribute('href') }));
}

function tabLinks() {
  const tabs = screen.getByRole('navigation', { name: 'Вхід або реєстрація' });
  return within(tabs)
    .getAllByRole('link')
    .map((link) => ({
      name: link.textContent,
      href: link.getAttribute('href'),
      current: link.getAttribute('aria-current'),
    }));
}

describe('the sign-in and sign-up screen', () => {
  afterEach(() => {
    resetSignIn();
    vi.useRealTimers();
  });

  it('the tabs link to /register then /login and mark the open mode as the current page', () => {
    renderAuthForm({ mode: 'register' });

    expect(tabLinks()).toEqual([
      { name: 'Створити акаунт', href: '/register', current: 'page' },
      { name: 'Увійти', href: '/login', current: null },
    ]);
  });

  it('on /login the sign-in tab is the current page', () => {
    renderAuthForm({ mode: 'login' });

    expect(tabLinks().map((link) => link.current)).toEqual([null, 'page']);
  });

  it.each(MODE_PROVIDER_ROWS)(
    '$mode with $enabled set up links only those providers to their API start routes',
    async ({ mode, enabled, links, divider }) => {
      server.use(oauthProvidersRoute(enabled));
      renderAuthForm({ mode }, <QueryProbe queryKey={PROVIDERS_KEY} />);
      await waitForQuery({ queryKey: PROVIDERS_KEY, status: 'success' });

      expect(oauthLinks()).toEqual(links);
      expect(screen.queryByText('АБО') !== null).toBe(divider);
      expect(screen.getByText(PRIVACY)).toBeDefined();
    },
  );

  it.each(OUTAGES)(
    'while the providers route $name the form shows no OAuth block and still takes an email',
    async ({ reply, settled }) => {
      server.use(oauthProvidersRoute(reply));
      const form = renderAuthForm({ mode: 'login' }, <QueryProbe queryKey={PROVIDERS_KEY} />);
      await waitForQuery({ queryKey: PROVIDERS_KEY, status: settled });

      expect(oauthLinks()).toEqual([]);
      expect(screen.queryByText('АБО')).toBeNull();
      expect(form.email).toHaveProperty('disabled', false);
      expect(form.submit).toHaveProperty('disabled', false);
    },
  );

  it.each(MODES)(
    '%s posts the form, so a submit before hydration keeps the password out of the URL',
    (mode) => {
      const form = renderAuthForm({ mode });

      expect(form.submit).toHaveProperty('form.method', 'post');
    },
  );

  it('429 with Retry-After 3 counts down in a timer, keeps submit off and clears at 0', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    rateLimitedLogin({ 'Retry-After': '3' });
    const form = renderAuthForm({ mode: 'login' });

    await form.fillAndSubmit(CREDENTIALS);
    const alert = await screen.findByRole('alert');
    const seen = [within(alert).getByRole('timer').textContent];
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    seen.push(within(alert).getByRole('timer').textContent);

    expect(alert.textContent).toBe('Забагато спробСпробуй знову через 1 с');
    expect(seen).toEqual(['3 с', '1 с']);
    expect(form.submit).toHaveProperty('disabled', true);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(form.submit).toHaveProperty('disabled', false);
  });

  it('429 without Retry-After asks to try later and keeps submit enabled', async () => {
    rateLimitedLogin({});
    const form = renderAuthForm({ mode: 'login' });

    await form.fillAndSubmit(CREDENTIALS);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Забагато спробСпробуй трохи пізніше.',
    );
    expect(screen.queryByRole('timer')).toBeNull();
    expect(form.submit).toHaveProperty('disabled', false);
  });

  it.each(MODES)('%s has no axe violations', async (mode) => {
    renderAuthForm({ mode });
    await screen.findAllByRole('link', { name: /^Продовжити з / });

    expect(await axeViolations()).toEqual([]);
  });
});
