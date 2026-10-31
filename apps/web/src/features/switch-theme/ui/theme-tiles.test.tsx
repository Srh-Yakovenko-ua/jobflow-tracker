import type { Theme } from '@jobflow/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';
import { ThemeProvider } from '@/shared/lib/theme';

import { ThemeTiles } from './theme-tiles';

describe('ThemeTiles', () => {
  it('an arrow key from the light tile picks dark, paints the page, keeps the cookie and tells the page', async () => {
    const user = userEvent.setup();
    const onThemeChange = vi.fn<(theme: Theme) => void>();
    render(
      <ThemeProvider initialTheme="light">
        <ThemeTiles onThemeChange={onThemeChange} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('radio', { name: uk.theme.light }).getAttribute('aria-checked')).toBe(
      'true',
    );

    await user.tab();
    await user.keyboard('{ArrowRight>}');

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
    expect(document.cookie).toContain('jobflow_theme=dark');
    expect(onThemeChange.mock.calls).toEqual([['dark']]);
    expect(screen.getByRole('radio', { name: uk.theme.dark }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });
});
