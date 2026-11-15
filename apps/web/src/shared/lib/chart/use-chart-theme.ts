'use client';

import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { useState } from 'react';

import { PAGE_FONTS, pageFont } from '../page-font';
import { usePrefersReducedMotion } from '../reduced-motion';
import { useShownScheme } from '../theme';
import { type ChartPalette, type ChartThemeOptions, chartThemeOptions } from './chart-options';
import { CHART_PRINT, usePrintCharts } from './print-charts';

export type ChartTheme = Readonly<{
  palette: ChartPalette;
  options: ChartThemeOptions;
}>;

export function useChartTheme(): ChartTheme {
  const palette = CHART_THEME[useShownScheme()];
  const print = usePrintCharts();
  const reduced = usePrefersReducedMotion() || print;
  const [fontFamily] = useState(() => pageFont(PAGE_FONTS.ui));
  const options = chartThemeOptions({ palette, reduced, fontFamily });
  return {
    palette,
    options: print ? { ...options, devicePixelRatio: CHART_PRINT.pixelRatio } : options,
  };
}
