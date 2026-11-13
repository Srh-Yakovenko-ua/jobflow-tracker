'use client';

import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { useState } from 'react';

import { usePrefersReducedMotion } from '../reduced-motion';
import { useShownScheme } from '../theme';
import { type ChartPalette, type ChartThemeOptions, chartThemeOptions } from './chart-options';

export type ChartTheme = Readonly<{
  palette: ChartPalette;
  options: ChartThemeOptions;
}>;

const PAGE_FONT_VARIABLE = '--font-onest';

function pageFontFamily(): string {
  if (typeof document === 'undefined') return CHART_THEME.font.ui;
  const family = getComputedStyle(document.documentElement)
    .getPropertyValue(PAGE_FONT_VARIABLE)
    .trim();
  return family || CHART_THEME.font.ui;
}

export function useChartTheme(): ChartTheme {
  const palette = CHART_THEME[useShownScheme()];
  const reduced = usePrefersReducedMotion();
  const [fontFamily] = useState(pageFontFamily);
  return { palette, options: chartThemeOptions({ palette, reduced, fontFamily }) };
}
