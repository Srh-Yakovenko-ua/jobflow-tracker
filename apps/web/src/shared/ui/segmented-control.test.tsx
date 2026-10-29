import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';

import { SegmentedControl } from './segmented-control';

const THEME_SEGMENTS = [
  { value: 'light', label: uk.theme.light },
  { value: 'dark', label: uk.theme.dark },
  { value: 'system', label: uk.theme.system },
] as const;

function renderThemes(value: (typeof THEME_SEGMENTS)[number]['value']) {
  const onValueChange = vi.fn();
  render(
    <SegmentedControl
      aria-label={uk.ui.theme}
      options={THEME_SEGMENTS}
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
