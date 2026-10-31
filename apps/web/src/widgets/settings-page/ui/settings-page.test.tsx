import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { userKeys } from '@/entities/user';
import { apiUrl, errorReply, recordSentRequests } from '@/test/api-handlers';
import { replace } from '@/test/navigation';
import { waitForQuery } from '@/test/query-status';
import { renderInApp } from '@/test/render-in-app';
import {
  regionOf,
  renderLoadedSettings,
  renderSettingsPage,
  SUGGESTIONS_KEY,
} from '@/test/render-settings-page';
import { server } from '@/test/server';
import { ME_RESPONSE } from '@/test/session-fixtures';

import { SettingsPage } from './settings-page';

vi.mock('next/navigation', () => import('@/test/navigation'));

const SECTIONS = ['Пошук і тиша', 'Повідомлення', 'AI та приватність', 'Вигляд і тема', 'Акаунт'];

const HIDDEN_ITEMS = [
  'Пуші в браузері',
  'Листи на пошту',
  'Токен букмарклета',
  'Видалити всі AI-результати',
  'Видалити акаунт',
];

afterEach(() => {
  window.location.hash = '';
});

describe('SettingsPage', () => {
  it('shows a loading status until the settings arrive', () => {
    renderSettingsPage();

    expect(screen.getByText('Завантаження…').getAttribute('role')).toBe('status');
    expect(screen.queryByRole('region', { name: 'Акаунт' })).toBeNull();
  });

  it('a failed load offers a retry that brings the settings in', async () => {
    let down = true;
    const { user } = renderSettingsPage({
      me: () =>
        down ? errorReply({ status: 500, type: 'internal_error' }) : HttpResponse.json(ME_RESPONSE),
    });
    await waitForQuery({ queryKey: userKeys.me(), status: 'error' });

    down = false;
    await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));

    expect(await screen.findByRole('region', { name: 'Акаунт' })).toBeDefined();
  });

  it('lays the page out in five named sections with a nav that marks the first one', async () => {
    await renderLoadedSettings();

    expect(SECTIONS.map((name) => regionOf(name).id)).toEqual([
      'search',
      'notifications',
      'aiPrivacy',
      'appearance',
      'account',
    ]);
    const nav = screen.getByRole('navigation', { name: 'Розділи налаштувань' });
    const current = within(nav).getByRole('link', { current: 'location' });
    expect(current.textContent).toBe('Пошук і тиша');
    expect(current.getAttribute('href')).toBe('#search');
  });

  it('the nav marks the section the reader jumped to', async () => {
    const { user } = await renderLoadedSettings();
    const nav = screen.getByRole('navigation', { name: 'Розділи налаштувань' });

    await user.click(within(nav).getByRole('link', { name: 'Акаунт' }));

    await waitFor(() => {
      expect(within(nav).getByRole('link', { current: 'location' }).textContent).toBe('Акаунт');
    });
  });

  it('leaves out every control whose delivery is not built yet', async () => {
    await renderLoadedSettings();

    for (const name of HIDDEN_ITEMS) {
      expect(screen.queryByText(name)).toBeNull();
    }
  });

  it('shows the name and the email read-only, and lists what the model sees', async () => {
    await renderLoadedSettings();

    expect(within(regionOf('Акаунт')).getByText('Андрій Ковальчук')).toBeDefined();
    expect(within(regionOf('Акаунт')).getByText('andrii@example.com')).toBeDefined();
    expect(within(regionOf('AI та приватність')).getAllByRole('listitem')).toHaveLength(3);
  });

  it('asks only for the session and the suggestions on open', async () => {
    const sent = recordSentRequests();
    await renderLoadedSettings();
    await waitForQuery({ queryKey: SUGGESTIONS_KEY, status: 'success' });

    expect(sent().map((request) => request.url)).toEqual([
      apiUrl('/auth/me'),
      apiUrl('/settings/suggestions'),
    ]);
  });

  it('a saved threshold is still there after the page opens again with a fresh cache', async () => {
    const { user } = await renderLoadedSettings();
    await user.click(screen.getByRole('radio', { name: '14' }));
    expect(await within(regionOf('Пошук і тиша')).findByText('Збережено')).toBeDefined();

    cleanup();
    renderInApp(<SettingsPage />);

    const fourteen = await screen.findByRole('radio', { name: '14' });
    expect(fourteen.getAttribute('aria-checked')).toBe('true');
  });

  it('a theme tile saves the theme', async () => {
    const { user, routes } = await renderLoadedSettings();

    await user.click(screen.getByRole('radio', { name: 'Темна' }));

    await waitFor(() => {
      expect(routes.patches).toEqual([{ theme: 'dark' }]);
    });
    expect(within(regionOf('Вигляд і тема')).getByRole('status').textContent).toBe('Збережено');
  });

  it('«Вийти на всіх пристроях» ends every session and goes to the login page', async () => {
    const { user } = await renderLoadedSettings();
    server.use(
      http.post(apiUrl('/auth/logout-all'), () => new HttpResponse(null, { status: 204 })),
    );

    await user.click(screen.getByRole('button', { name: 'Вийти на всіх пристроях' }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
  });
});
