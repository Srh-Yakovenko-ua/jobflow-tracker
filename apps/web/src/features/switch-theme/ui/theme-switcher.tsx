'use client';

import { uk } from '@/shared/i18n';
import { THEME_OPTIONS, useTheme } from '@/shared/lib/theme';
import { SegmentedControl } from '@/shared/ui/segmented-control';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <SegmentedControl
      aria-label={uk.ui.theme}
      options={THEME_OPTIONS}
      value={theme}
      onValueChange={setTheme}
    />
  );
}
