import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';
import { ThemeProvider } from '@/shared/lib/theme';

import { ThemeSwitcher } from './theme-switcher';

describe('ThemeSwitcher', () => {
  it('a click on the dark segment paints the page dark and remembers it in the cookie', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider initialTheme="light">
        <ThemeSwitcher />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('radio', { name: uk.theme.dark }));

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
    expect(document.cookie).toContain('jobflow_theme=dark');
    expect(screen.getByRole('radiogroup', { name: uk.ui.theme })).toBeDefined();
  });
});
