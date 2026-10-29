import type { Theme } from '@jobflow/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';
import { THEME_OPTIONS } from '@/shared/lib/theme';

import { SegmentedControl } from './segmented-control';

function renderThemes(value: Theme) {
  const onValueChange = vi.fn();
  render(
    <SegmentedControl
      aria-label={uk.ui.theme}
      options={THEME_OPTIONS}
      value={value}
      onValueChange={onValueChange}
    />,
  );
  return { user: userEvent.setup(), onValueChange };
}

describe('SegmentedControl', () => {
  it('ArrowRight moves to the next segment and reports its value', async () => {
    const { user, onValueChange } = renderThemes('dark');

    await user.tab();
    await user.keyboard('{ArrowRight>}');

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledExactlyOnceWith('system');
    });
  });

  it('a click on a segment picks it while the picked one stays read as checked', async () => {
    const { user, onValueChange } = renderThemes('light');

    await user.click(screen.getByRole('radio', { name: uk.theme.system }));

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('system');
    expect(screen.getByRole('radio', { checked: true }).textContent).toBe(uk.theme.light);
  });
});
