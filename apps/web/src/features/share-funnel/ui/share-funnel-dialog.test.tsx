import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderInApp } from '@/test/render-in-app';
import { designFunnelStory } from '@/test/share-story';

import { ShareFunnelButton } from './share-funnel-button';

const FAILED = 'Не вдалося намалювати картинку';

async function openShareDialog() {
  const user = renderInApp(<ShareFunnelButton story={designFunnelStory()} />);
  await user.click(screen.getByRole('button', { name: 'Поділитися' }));
  const dialog = await screen.findByRole('dialog', { name: 'Поділитися пошуком' });
  return { user, dialog: within(dialog) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ShareFunnelButton', () => {
  it('opens a dialog with the theme choice on the shown theme, the numbers switch off and both actions named', async () => {
    const { dialog } = await openShareDialog();

    const theme = dialog.getByRole('radiogroup', { name: 'Тема картинки' });
    expect(within(theme).getByRole('radio', { name: 'Світла' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(within(theme).getByRole('radio', { name: 'Темна' }).getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(
      dialog.getByRole('switch', { name: 'Приховати числа' }).getAttribute('aria-checked'),
    ).toBe('false');
    expect(dialog.getByRole('button', { name: 'Завантажити PNG' })).toBeDefined();
    expect(dialog.getByRole('button', { name: 'Скопіювати в буфер' })).toBeDefined();
  });

  it('a browser that gives no canvas shows the failed state, keeps download and copy off, and a retry draws again', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const { user, dialog } = await openShareDialog();

    expect(await dialog.findByText(FAILED)).toBeDefined();
    expect(dialog.getByRole('alert').textContent).toContain(FAILED);
    expect(dialog.getByRole('button', { name: 'Завантажити PNG' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(dialog.getByRole('button', { name: 'Скопіювати в буфер' })).toHaveProperty(
      'disabled',
      true,
    );
    const drawsBefore = getContext.mock.calls.length;

    await user.click(dialog.getByRole('button', { name: 'Спробувати ще раз' }));

    expect(await dialog.findByText(FAILED)).toBeDefined();
    expect(getContext.mock.calls.length).toBeGreaterThan(drawsBefore);
  });
});
