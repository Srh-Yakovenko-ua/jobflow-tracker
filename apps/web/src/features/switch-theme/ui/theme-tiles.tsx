'use client';

import { type Theme, THEMES } from '@jobflow/shared';
import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { THEME_OPTIONS, useTheme } from '@/shared/lib/theme';

export type ThemeTilesProps = Readonly<{ onThemeChange: (theme: Theme) => void }>;

type Scheme = Exclude<Theme, 'system'>;

type SwatchProps = Readonly<{ scheme: Scheme; children?: ReactNode }>;

const LIGHT_VARIABLES = Object.fromEntries(
  Object.entries(CHART_THEME.light.colors).map(([name, value]) => [`--${name}`, value]),
);

function Swatch({ scheme, children }: SwatchProps) {
  return (
    <span
      data-theme={scheme === 'dark' ? scheme : undefined}
      style={scheme === 'light' ? LIGHT_VARIABLES : undefined}
      className="flex min-w-0 flex-1 flex-col gap-1.25 bg-paper p-2.25 inset-ring inset-ring-line-soft"
    >
      {children}
    </span>
  );
}

function Sketch() {
  return (
    <>
      <span className="h-2 w-[60%] bg-ink" />
      <span className="h-1.25 w-[88%] bg-line" />
      <span className="mt-auto h-5 w-full rounded-pill bg-surface shadow-e1" />
    </>
  );
}

const PREVIEWS: Readonly<Record<Theme, ReactNode>> = {
  light: (
    <Swatch scheme="light">
      <Sketch />
    </Swatch>
  ),
  dark: (
    <Swatch scheme="dark">
      <Sketch />
    </Swatch>
  ),
  system: (
    <>
      <Swatch scheme="light" />
      <Swatch scheme="dark" />
    </>
  ),
};

const TILE =
  'group flex cursor-pointer flex-col rounded-lg border-2 border-transparent p-0.75 transition-colors duration-(--duration-fast) ease-standard not-data-[state=checked]:hover:border-line not-data-[state=checked]:active:border-ink-3 data-[state=checked]:border-accent';

export function ThemeTiles({ onThemeChange }: ThemeTilesProps) {
  const { theme, setTheme } = useTheme();
  return (
    <RadioGroupPrimitive.Root
      aria-label={uk.ui.theme}
      orientation="horizontal"
      value={theme}
      onValueChange={(next) => {
        const picked = THEMES.find((candidate) => candidate === next);
        if (picked === undefined) return;
        setTheme(picked);
        onThemeChange(picked);
      }}
      className="flex flex-wrap gap-3"
    >
      {THEME_OPTIONS.map((option) => (
        <RadioGroupPrimitive.Item key={option.value} value={option.value} className={TILE}>
          <span aria-hidden className="flex h-21 w-33">
            {PREVIEWS[option.value]}
          </span>
          <span className="pt-1.5 pb-0.5 text-center text-[12px] text-ink-3 group-data-[state=checked]:font-semibold group-data-[state=checked]:text-ink">
            {option.label}
          </span>
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
