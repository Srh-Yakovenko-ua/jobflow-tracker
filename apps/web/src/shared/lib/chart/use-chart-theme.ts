'use client';

import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { useState } from 'react';

import { PAGE_FONTS, pageFont } from '../page-font';
import { usePrefersReducedMotion } from '../reduced-motion';
import { useShownScheme } from '../theme';
import { type ChartPalette, type ChartThemeOptions, chartThemeOptions } from './chart-options';

export type ChartTheme = Readonly<{
  palette: ChartPalette;
  options: ChartThemeOptions;
}>;

export function useChartTheme(): ChartTheme {
  const palette = CHART_THEME[useShownScheme()];
  const reduced = usePrefersReducedMotion();
  const [fontFamily] = useState(() => pageFont(PAGE_FONTS.ui));
  return { palette, options: chartThemeOptions({ palette, reduced, fontFamily }) };
}
