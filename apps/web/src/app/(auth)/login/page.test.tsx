import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderInApp } from '@/test/render-in-app';

import LoginPage from './page';

vi.mock('next/navigation', () => import('@/test/navigation'));

async function renderLogin(oauth: string) {
  renderInApp(
    await LoginPage({ params: Promise.resolve({}), searchParams: Promise.resolve({ oauth }) }),
  );
}

describe('the login page', () => {
  it('?oauth=denied says the provider sign-in was cancelled in a polite status', async () => {
    await renderLogin('denied');

    expect(screen.getByRole('status').textContent).toBe(
      'Вхід через Google або GitHub скасованоУвійди поштою або спробуй ще раз.',
    );
  });

  it('any other oauth value shows no notice', async () => {
    await renderLogin('granted');

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Увійти' })).toBeDefined();
  });
});
