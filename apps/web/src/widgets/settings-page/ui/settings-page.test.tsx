import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { userKeys } from '@/entities/user';
import { exportRoutes } from '@/test/account-fixtures';
import { apiUrl, errorReply, recordSentRequests } from '@/test/api-handlers';
import { scrollIntoBand } from '@/test/intersection-observer';
import { replace } from '@/test/navigation';
import { EXPORT_ID } from '@/test/notification-fixtures';
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
vi.mock('next/link', () => import('@/test/link'));

const SECTIONS = [
  'Пошук і тиша',
  'Ритм пошуку',
  'Сповіщення',
  'AI та приватність',
  'Вигляд і тема',
  'Акаунт',
];

const REVOKE_BOOKMARKLET = { name: 'Вимкнути букмарклет' } as const;

afterEach(() => {
  window.location.hash = '';
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
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

  it('lays the page out in six named sections with a nav that marks the first one', async () => {
    await renderLoadedSettings();

    expect(SECTIONS.map((name) => regionOf(name).id)).toEqual([
      'search',
      'rhythm',
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

  it('the nav marks AI та приватність when the address carries the bookmarklet anchor', async () => {
    window.location.hash = '#bookmarklet';
    await renderLoadedSettings();

    const nav = within(screen.getByRole('navigation', { name: 'Розділи налаштувань' }));

    expect(nav.getByRole('link', { current: 'location' }).textContent).toBe('AI та приватність');
  });

  it('a cold load with the bookmarklet anchor scrolls to the bookmarklet block once the settings arrive, not while the skeleton shows', async () => {
    window.location.hash = '#bookmarklet';
    const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView');
    renderSettingsPage();
    expect(screen.getByText('Завантаження…')).toBeDefined();
    expect(scrolled).not.toHaveBeenCalled();

    await waitForQuery({ queryKey: userKeys.me(), status: 'success' });

    expect(scrolled.mock.contexts).toHaveLength(1);
    expect(scrolled.mock.contexts[0]).toBe(document.getElementById('bookmarklet'));
  });

  it('a load with no anchor in the address scrolls nowhere', async () => {
    const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView');

    await renderLoadedSettings();

    expect(screen.getByRole('region', { name: 'Акаунт' })).toBeDefined();
    expect(scrolled).not.toHaveBeenCalled();
  });

  it('the bookmarklet heading sits inside the block that carries the bookmarklet anchor', async () => {
    await renderLoadedSettings();

    const heading = screen.getByRole('heading', { level: 2, name: 'Букмарклет' });

    expect(heading.closest('[id]')?.id).toBe('bookmarklet');
  });

  it('shows the browser push switch in Сповіщення', async () => {
    await renderLoadedSettings();

    expect(
      within(regionOf('Сповіщення')).getByRole('switch', { name: /Сповіщення в браузері/ }),
    ).toBeDefined();
  });

  it('shows the email switch in Сповіщення', async () => {
    await renderLoadedSettings();

    expect(
      within(regionOf('Сповіщення')).getByRole('switch', { name: /Листи на пошту/ }),
    ).toBeDefined();
  });

  it('shows the name and the email read-only', async () => {
    await renderLoadedSettings();

    expect(within(regionOf('Акаунт')).getByText('Андрій Ковальчук')).toBeDefined();
    expect(within(regionOf('Акаунт')).getByText('andrii@example.com')).toBeDefined();
  });

  it('an account with no name shows the email once and no name row', async () => {
    await renderLoadedSettings({
      me: () =>
        HttpResponse.json({ ...ME_RESPONSE, user: { ...ME_RESPONSE.user, displayName: null } }),
    });
    const account = within(regionOf('Акаунт'));

    expect(account.queryByText("Ім'я")).toBeNull();
    expect(account.getAllByText(ME_RESPONSE.user.email)).toHaveLength(1);
  });

  it('lists only what the code sends to the model and offers to delete every AI result', async () => {
    await renderLoadedSettings();
    const aiPrivacy = regionOf('AI та приватність');

    const modelData = within(aiPrivacy).getByRole('list', { name: 'Що бачить AI' });

    expect(
      within(modelData)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Розбір вакансії: текст вакансії.',
      'Розбір резюме: текст резюме без контактів, скан, якщо немає тексту.',
      'Match Score: текст вакансії, профіль резюме.',
      'Фоллоу-ап: імʼя рекрутера, компанія, посада, етап, дні тиші, остання співбесіда, твоє імʼя, мова, тон, твоя підказка.',
      'Місячне AI-саммарі: місяці, лише цифри статистики, висновки, поради, прогрес плану.',
      'Підказки до резюме: посада, Match Score, вимоги вакансії, профіль резюме.',
      'Підготовка до співбесіди: посада, тип співбесіди, вимоги вакансії, прогалини резюме, слабкі місця.',
      'Текст нотаток AI не бачить, лише позначені теми.',
    ]);
    expect(
      within(aiPrivacy).getByRole('button', { name: 'Видалити все, що зробив AI' }),
    ).toBeDefined();
  });

  it('the delete note in AI та приватність says the vacancies, resumes and plans stay', async () => {
    await renderLoadedSettings();

    expect(
      within(regionOf('AI та приватність')).getByText(/Вакансії, резюме й плани лишаться\.$/),
    ).toBeDefined();
  });

  it('holds the bookmarklet block with the state of the active capture token and its controls', async () => {
    await renderLoadedSettings();
    const aiPrivacy = within(regionOf('AI та приватність'));

    expect(aiPrivacy.getByRole('heading', { level: 2, name: 'Букмарклет' })).toBeDefined();
    expect(await aiPrivacy.findByText('10.11, 01:15')).toBeDefined();
    expect(aiPrivacy.getByRole('button', REVOKE_BOOKMARKLET)).toBeDefined();
    expect(aiPrivacy.getByRole('button', { name: 'Створити нову кнопку' })).toBeDefined();
  });

  it('asks only for the session, the suggestions and the capture tokens on open, and creates no token', async () => {
    const sent = recordSentRequests();
    await renderLoadedSettings();
    await waitForQuery({ queryKey: SUGGESTIONS_KEY, status: 'success' });
    await screen.findByRole('button', REVOKE_BOOKMARKLET);

    expect(sent().map(({ method, url }) => ({ method, url }))).toEqual([
      { method: 'GET', url: apiUrl('/auth/me') },
      { method: 'GET', url: apiUrl('/settings/suggestions') },
      { method: 'GET', url: apiUrl('/capture/tokens') },
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

  it('«Гарячі клавіші з однієї літери» is on by default and turning it off saves only that field', async () => {
    const { user, routes } = await renderLoadedSettings();
    const singleKeys = within(regionOf('Вигляд і тема')).getByRole('switch', {
      name: /Гарячі клавіші з однієї літери/,
    });
    expect(singleKeys.getAttribute('aria-checked')).toBe('true');

    await user.click(singleKeys);

    await waitFor(() => {
      expect(routes.patches).toEqual([{ singleKeyShortcuts: false }]);
    });
    expect(singleKeys.getAttribute('aria-checked')).toBe('false');
  });

  it('Акаунт offers the data export, a link to the CSV import and the account deletion', async () => {
    await renderLoadedSettings();
    const account = within(regionOf('Акаунт'));

    expect(account.getByRole('button', { name: 'Вивантажити' })).toBeDefined();
    expect(account.getByRole('link', { name: 'Імпортувати CSV' }).getAttribute('href')).toBe(
      '/import',
    );
    expect(account.getByRole('button', { name: 'Видалити акаунт' })).toBeDefined();
  });

  it('an export id in the address offers its download in Акаунт and again in the deletion dialog', async () => {
    window.history.replaceState(null, '', `/settings?export=${EXPORT_ID}#account`);
    const exports = exportRoutes({ readyAfterLinks: 0 });
    server.use(...exports.handlers);
    const { user } = await renderLoadedSettings();
    const account = within(regionOf('Акаунт'));

    expect(await account.findByRole('link', { name: 'Завантажити архів' })).toBeDefined();
    await user.click(account.getByRole('button', { name: 'Видалити акаунт' }));
    const dialog = within(await screen.findByRole('alertdialog'));
    expect(await dialog.findByRole('link', { name: 'Завантажити архів' })).toBeDefined();
    expect(dialog.getByRole('button', { name: 'Вивантажити' })).toBeDefined();
    expect(exports.sent.requests).toEqual([]);
    expect(new Set(exports.sent.links)).toEqual(new Set([EXPORT_ID]));
  });

  it('a crafted export param sends no request outside /me/exports', async () => {
    window.history.replaceState(null, '', '/settings?export=..%2F..%2Fauth%2Flogout-all#account');
    const sentRequests = recordSentRequests();
    server.use(...exportRoutes().handlers);
    await renderLoadedSettings();
    const account = within(regionOf('Акаунт'));

    expect(account.getByRole('button', { name: 'Вивантажити' })).toBeDefined();
    const paths = sentRequests().map(
      ({ url }) => new URL(url instanceof Request ? url.url : url).pathname,
    );
    expect(paths.filter((path) => /logout-all|\/me\/exports/.test(path))).toEqual([]);
    expect(account.queryByText('Збираю архів…')).toBeNull();
  });

  it('«Вийти на всіх пристроях» says it switches the bookmarklet off too', async () => {
    await renderLoadedSettings();

    expect(within(regionOf('Акаунт')).getByText(/вимикає букмарклет/)).toBeDefined();
  });

  it('«Вийти на всіх пристроях» ends every session and goes to the login page', async () => {
    const { user } = await renderLoadedSettings();
    server.use(
      http.post(apiUrl('/auth/logout-all'), () => new HttpResponse(null, { status: 204 })),
    );

    await user.click(screen.getByRole('button', { name: 'Вийти на всіх пристроях' }));
    const dialog = within(await screen.findByRole('alertdialog'));
    await user.click(dialog.getByRole('button', { name: 'Вийти всюди' }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
  });

  it('«Вийти на всіх пристроях» asks first, and «Скасувати» ends no session', async () => {
    const { user } = await renderLoadedSettings();
    const sent = recordSentRequests();

    await user.click(screen.getByRole('button', { name: 'Вийти на всіх пристроях' }));
    const dialog = within(
      await screen.findByRole('alertdialog', { name: 'Вийти на всіх пристроях?' }),
    );
    expect(dialog.getByText('Букмарклет теж перестане працювати.')).toBeDefined();
    await user.click(dialog.getByRole('button', { name: 'Скасувати' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(sent().filter(({ url }) => url === apiUrl('/auth/logout-all'))).toEqual([]);
  });

  it('the nav follows the section that scrolls under it', async () => {
    await renderLoadedSettings();
    const nav = within(screen.getByRole('navigation', { name: 'Розділи налаштувань' }));

    scrollIntoBand(regionOf('Сповіщення'));
    expect(nav.getByRole('link', { current: 'location' }).textContent).toBe('Сповіщення');

    scrollIntoBand(null);
    expect(nav.getByRole('link', { current: 'location' }).textContent).toBe('Сповіщення');

    scrollIntoBand(regionOf('Акаунт'));
    expect(nav.getByRole('link', { current: 'location' }).textContent).toBe('Акаунт');
  });

  it('a nav link picked after scrolling is the one marked', async () => {
    const { user } = await renderLoadedSettings();
    const nav = within(screen.getByRole('navigation', { name: 'Розділи налаштувань' }));
    scrollIntoBand(regionOf('Сповіщення'));

    await user.click(nav.getByRole('link', { name: 'Вигляд і тема' }));

    await waitFor(() => {
      expect(nav.getByRole('link', { current: 'location' }).textContent).toBe('Вигляд і тема');
    });
  });
});
