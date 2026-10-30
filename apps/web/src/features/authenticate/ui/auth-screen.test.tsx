import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { rateLimitedReply } from '@/test/api-handlers';
import { CREDENTIALS, renderAuthForm, resetSignIn } from '@/test/auth-form';
import { axeViolations } from '@/test/dev-ui';
import { server } from '@/test/server';
import { authRoute } from '@/test/session-fixtures';

import type { AuthMode } from '../model/auth-modes';

vi.mock('next/navigation', () => import('@/test/navigation'));

const MODES: readonly AuthMode[] = ['login', 'register'];

const PRIVACY =
  'Твої відгуки, заметки й резюме видно тільки тобі. Тексти вакансій ідуть у модель для розбору; заметки — ніколи.';

function rateLimitedLogin(headers: Record<string, string>) {
  server.use(authRoute({ path: '/auth/login', reply: () => rateLimitedReply(headers) }));
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

  it.each(MODES)(
    '%s shows the Google and GitHub links to the API start routes and the privacy note',
    (mode) => {
      renderAuthForm({ mode });

      expect(
        ['Продовжити з Google', 'Продовжити з GitHub'].map((name) =>
          screen.getByRole('link', { name }).getAttribute('href'),
        ),
      ).toEqual([
        'http://localhost:4000/api/v1/auth/oauth/google/start',
        'http://localhost:4000/api/v1/auth/oauth/github/start',
      ]);
      expect(screen.getByText(PRIVACY)).toBeDefined();
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
    expect(screen.queryByRole('alert')).toBeNull();
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

    expect(await axeViolations()).toEqual([]);
  });
});
