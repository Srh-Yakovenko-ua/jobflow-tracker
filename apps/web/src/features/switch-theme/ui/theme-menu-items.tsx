'use client';

import { themeSchema } from '@jobflow/shared';
import { useId } from 'react';

import { uk } from '@/shared/i18n';
import { THEME_OPTIONS, useTheme } from '@/shared/lib/theme';
import { MenuLabel, MenuRadioGroup, MenuRadioItem } from '@/shared/ui/menu';

export function ThemeMenuItems() {
  const labelId = useId();
  const { theme, setTheme } = useTheme();

  function pick(value: string) {
    const picked = themeSchema.safeParse(value);
    if (picked.success) setTheme(picked.data);
  }

  return (
    <>
      <MenuLabel id={labelId}>{uk.ui.theme}</MenuLabel>
      <MenuRadioGroup aria-labelledby={labelId} value={theme} onValueChange={pick}>
        {THEME_OPTIONS.map((option) => (
          <MenuRadioItem key={option.value} value={option.value}>
            {option.label}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
    </>
  );
}
