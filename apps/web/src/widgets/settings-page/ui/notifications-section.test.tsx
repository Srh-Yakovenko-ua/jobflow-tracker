import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { regionOf, renderLoadedSettings } from '@/test/render-settings-page';

vi.mock('next/navigation', () => import('@/test/navigation'));

const notifications = () => within(regionOf('Повідомлення'));

describe('NotificationsSection', () => {
  it('the in-app switch saves only its own field', async () => {
    const { user, routes } = await renderLoadedSettings();

    await user.click(notifications().getByRole('switch', { name: /Сповіщення в застосунку/ }));

    await waitFor(() => {
      expect(routes.patches).toEqual([{ notifyInApp: true }]);
    });
    expect(notifications().getByRole('status').textContent).toBe('Збережено');
  });

  it('a quiet hour is saved on leaving the field, and only when it changed', async () => {
    const { user, routes } = await renderLoadedSettings();
    const start = notifications().getByLabelText('Від');
    const end = notifications().getByLabelText('До');

    await user.click(end);
    await user.tab();
    await user.clear(start);
    await user.type(start, '22:15');
    await user.tab();

    await waitFor(() => {
      expect(routes.patches).toEqual([{ quietHoursStart: '22:15' }]);
    });
    expect(start).toHaveProperty('value', '22:15');
  });

  it('a cleared quiet hour is not saved and shows the stored time again', async () => {
    const { user, routes } = await renderLoadedSettings();
    const start = notifications().getByLabelText('Від');

    await user.clear(start);
    await user.tab();

    expect(start).toHaveProperty('value', '21:30');
    expect(routes.patches).toEqual([]);
  });

  it('the time zone is picked from a searchable list and cannot be cleared', async () => {
    const { user, routes } = await renderLoadedSettings();
    const timeZone = notifications().getByRole('combobox', { name: 'Часовий пояс' });

    expect(timeZone.textContent).toBe('Europe/Kyiv');
    expect(notifications().queryByRole('button', { name: 'Скинути' })).toBeNull();
    await user.click(timeZone);
    await user.type(await screen.findByPlaceholderText('Пошук поясу'), 'Tokyo');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(routes.patches).toEqual([{ timezone: 'Asia/Tokyo' }]);
    });
    expect(timeZone.textContent).toBe('Asia/Tokyo');
  });
});
