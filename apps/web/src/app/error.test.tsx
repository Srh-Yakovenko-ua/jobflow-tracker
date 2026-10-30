import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CRASH_SECRET, renderCrashedPage } from '@/test/crashed-page';
import { quietLogs } from '@/test/quiet-logs';

import ErrorPage from './error';

describe('the page error boundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the crash panel with the Next digest as the code and never the error message', () => {
    quietLogs();
    renderCrashedPage(ErrorPage);

    expect(screen.getByRole('heading', { level: 1, name: 'Помилка на нашому боці' })).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Щось зламалось у нас, не в тебе' }),
    ).toBeDefined();
    expect(screen.getByText('Сторінка впала')).toBeDefined();
    expect(screen.getByText(/^код 3f9a1c27 · \d{2}\.\d{2}, \d{2}:\d{2}$/)).toBeDefined();
    expect(document.body.textContent).not.toContain(CRASH_SECRET);
  });

  it('reload calls unstable_retry once', async () => {
    quietLogs();
    const { retry, user } = renderCrashedPage(ErrorPage);

    await user.click(screen.getByRole('button', { name: 'Перезавантажити' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('logs the crash once under the code the panel shows', () => {
    const logged = quietLogs();
    renderCrashedPage(ErrorPage);

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0]?.[0]).toMatchObject({ code: '3f9a1c27' });
  });
});
