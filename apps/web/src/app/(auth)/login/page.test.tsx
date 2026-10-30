import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authFormOf, CREDENTIALS, expectSignedIn, resetSignIn } from '@/test/auth-form';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { authRoute } from '@/test/session-fixtures';

import LoginPage from './page';

vi.mock('next/navigation', () => import('@/test/navigation'));

async function renderLogin(query: Record<string, string>) {
  const user = renderInApp(
    await LoginPage({ params: Promise.resolve({}), searchParams: Promise.resolve(query) }),
  );
  return authFormOf({ user, mode: 'login' });
}

describe('the login page', () => {
  afterEach(resetSignIn);

  it('?oauth=denied says the provider sign-in was cancelled in a polite status', async () => {
    await renderLogin({ oauth: 'denied' });

    expect(screen.getByRole('status').textContent).toBe(
      'Вхід через Google або GitHub скасованоУвійди поштою або спробуй ще раз.',
    );
  });

  it('any other oauth value shows no notice', async () => {
    await renderLogin({ oauth: 'granted' });

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Увійти' })).toBeDefined();
  });

  it.each([
    { next: '/applications/123', lands: '/applications/123' },
    { next: 'https://evil.test/board', lands: '/board' },
  ])('signing in from ?next=$next lands on $lands', async ({ next, lands }) => {
    server.use(authRoute({ path: '/auth/login' }));
    const form = await renderLogin({ next });

    await form.fillAndSubmit(CREDENTIALS);

    await expectSignedIn(lands);
  });
});
