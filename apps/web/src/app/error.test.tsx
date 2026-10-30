import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { quietLogs } from '@/test/quiet-logs';

import ErrorPage from './error';

const SECRET = 'connect ECONNREFUSED 10.0.0.7:5432 as jobflow';

function crashedPage() {
  const retry = vi.fn();
  const error = Object.assign(new Error(SECRET), { digest: '3f9a1c27' });
  render(<ErrorPage error={error} unstable_retry={retry} />);
  return { retry, user: userEvent.setup() };
}

describe('the page error boundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the crash panel with the Next digest as the code and never the error message', () => {
    quietLogs();
    crashedPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Помилка на нашому боці' })).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Щось зламалось у нас, не в тебе' }),
    ).toBeDefined();
    expect(screen.getByText('Сторінка впала')).toBeDefined();
    expect(screen.getByText(/^код 3f9a1c27 · \d{2}\.\d{2}, \d{2}:\d{2}$/)).toBeDefined();
    expect(document.body.textContent).not.toContain(SECRET);
  });

  it('reload calls unstable_retry once', async () => {
    quietLogs();
    const { retry, user } = crashedPage();

    await user.click(screen.getByRole('button', { name: 'Перезавантажити' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('logs the crash once under the code the panel shows', () => {
    const logged = quietLogs();
    crashedPage();

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0]?.[0]).toMatchObject({ code: '3f9a1c27' });
  });
});
