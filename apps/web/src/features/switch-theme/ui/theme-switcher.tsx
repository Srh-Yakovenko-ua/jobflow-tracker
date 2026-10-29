'use client';

import { THEMES } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { useTheme } from '@/shared/lib/theme';
import { SegmentedControl } from '@/shared/ui/segmented-control';

const THEME_OPTIONS = THEMES.map((theme) => ({ value: theme, label: uk.theme[theme] }));

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
