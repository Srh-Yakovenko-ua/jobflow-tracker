import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { act } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useTheme } from '@/shared/lib/theme';
import { stubMotionPreference } from '@/test/motion-preference';
import { renderHookInTheme } from '@/test/theme';

import { useChartTheme } from './use-chart-theme';

const HASHED_ONEST = "'Onest', 'Onest Fallback'";

const { light, dark } = CHART_THEME;

function renderChartTheme() {
  return renderHookInTheme(() => ({ chart: useChartTheme(), ...useTheme() }), 'light');
}

describe('useChartTheme', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--font-onest');
  });

  it('switches the series and tooltip colours to the dark tokens in the same chart, with no remount', () => {
    const { result } = renderChartTheme();
    const { palette, options } = result.current.chart;
    expect(palette).toBe(light);
    expect(options.plugins.tooltip.backgroundColor).toBe(light.colors.ink);

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.chart.palette).toBe(dark);
    expect(result.current.chart.palette.data[0]).not.toBe(light.data[0]);
    expect(result.current.chart.options.plugins.tooltip.backgroundColor).toBe(dark.colors.ink);
  });

  it('turns chart animation off when the user asks for reduced motion', () => {
    const { result } = renderChartTheme();
    expect(result.current.chart.options.animation).toBeUndefined();

    act(() => {
      stubMotionPreference('reduce');
    });

    expect(result.current.chart.options.animation).toBe(false);
  });

  it('draws canvas text in the family next/font put on the page, and in Onest when none is there', () => {
    expect(renderChartTheme().result.current.chart.options.font).toEqual({ family: 'Onest' });

    document.documentElement.style.setProperty('--font-onest', HASHED_ONEST);
    const { options } = renderChartTheme().result.current.chart;

    expect(options.font).toEqual({ family: HASHED_ONEST });
    expect(options.plugins.tooltip.bodyFont).toEqual({ family: HASHED_ONEST });
  });
});
