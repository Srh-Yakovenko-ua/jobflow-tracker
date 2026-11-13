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

const HIDDEN_ITEMS = ['Пуші в браузері', 'Листи на пошту', 'Видалити акаунт'];

const REVOKE_BOOKMARKLET = { name: 'Вимкнути букмарклет' } as const;

afterEach(() => {
  window.location.hash = '';
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

  it('leaves out every control whose delivery is not built yet', async () => {
    await renderLoadedSettings();

    for (const name of HIDDEN_ITEMS) {
      expect(screen.queryByText(name)).toBeNull();
    }
  });

  it('shows the name and the email read-only', async () => {
    await renderLoadedSettings();

    expect(within(regionOf('Акаунт')).getByText('Андрій Ковальчук')).toBeDefined();
    expect(within(regionOf('Акаунт')).getByText('andrii@example.com')).toBeDefined();
  });

  it('lists only what the code sends to the model and offers to delete every AI result', async () => {
    await renderLoadedSettings();
    const aiPrivacy = regionOf('AI та приватність');

    const modelData = within(aiPrivacy).getByRole('list', { name: 'Що бачить модель' });

    expect(
      within(modelData)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Текст вакансії: з нього модель дістає компанію, посаду, зарплату, формат роботи й стек.',
      'Текст резюме без email, телефону, Telegram і адреси: з нього модель збирає навички, роки досвіду, рівень і англійську.',
      'Сторінки скану резюме як зображення, до трьох: лише коли у файлі немає тексту.',
      'Посада, стек і текст вакансії: з них модель виділяє вимоги та їхню вагу.',
      'Профіль резюме без цитат, компаній і контактів: навички з роками, рівень, англійська, домени й досвід лідерства. З ним модель звіряє кожну вимогу.',
      'Імʼя рекрутера, лише перше слово: щоб привітатися. Без нього лист почнеться загальним вітанням.',
      'Назва компанії: щоб лист був саме про неї.',
      'Посада з картки: щоб назвати роль, на яку ти подавався.',
      'Поточний етап: щоб модель знала, після чого ти пишеш.',
      'Скільки днів тиші: щоб тон відповідав паузі.',
      'Тип і дата останньої співбесіди, що вже відбулася: щоб подякувати саме за неї.',
      'Твоє імʼя з профілю: для підпису. Без нього лист буде без підпису.',
      'Мова листа: українська чи англійська, за мовою вакансії або твоїм вибором.',
      'Тон, який ти обрав: нейтральний, теплий чи короткий.',
      'Підказка з поля «Що згадати», якщо ти її написав. Нотатки в модель не йдуть.',
    ]);
    expect(
      within(aiPrivacy).getByRole('button', { name: 'Видалити всі AI-результати' }),
    ).toBeDefined();
  });

  it('holds the bookmarklet block with the state of the active capture token and its controls', async () => {
    await renderLoadedSettings();
    const aiPrivacy = within(regionOf('AI та приватність'));

    expect(aiPrivacy.getByRole('heading', { level: 2, name: 'Букмарклет' })).toBeDefined();
    expect(await aiPrivacy.findByText('10.11, 01:15')).toBeDefined();
    expect(aiPrivacy.getByRole('button', REVOKE_BOOKMARKLET)).toBeDefined();
    expect(aiPrivacy.getByRole('button', { name: 'Нова кнопка' })).toBeDefined();
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

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
  });
});
