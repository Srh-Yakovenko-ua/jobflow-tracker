import { screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderInApp } from '@/test/render-in-app';

import { CopyButton } from './copy-button';

const EMAIL = 'o.levchenko@acme.io';

const LABEL = 'Скопіювати email';

afterEach(() => {
  toast.dismiss();
  vi.restoreAllMocks();
});

describe('CopyButton', () => {
  it('writes the raw value to the clipboard and says it is copied', async () => {
    const user = renderInApp(<CopyButton value={EMAIL} label={LABEL} />);

    await user.click(screen.getByRole('button', { name: LABEL }));

    expect(await screen.findByText('Скопійовано')).toBeDefined();
    expect(await navigator.clipboard.readText()).toBe(EMAIL);
  });

  it('a clipboard the browser refuses shows that nothing was copied', async () => {
    const user = renderInApp(<CopyButton value={EMAIL} label={LABEL} />);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    await user.click(screen.getByRole('button', { name: LABEL }));

    expect(await screen.findByText('Не вдалося скопіювати')).toBeDefined();
    expect(screen.queryByText('Скопійовано')).toBeNull();
  });
});
