import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderCrashedPage } from '@/test/crashed-page';
import { quietLogs } from '@/test/quiet-logs';

import ProductErrorPage from './error';

describe('the error boundary inside the product shell', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the crash panel without a main landmark of its own, so the shell keeps the only one', () => {
    quietLogs();
    renderCrashedPage(ProductErrorPage);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Щось зламалось у нас, не в тебе' }),
    ).toBeDefined();
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('Перезавантажити calls unstable_retry once', async () => {
    quietLogs();
    const { retry, user } = renderCrashedPage(ProductErrorPage);

    await user.click(screen.getByRole('button', { name: 'Перезавантажити' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
