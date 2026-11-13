import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { describe, expect, it } from 'vitest';

import { type ChartPalette, type ChartThemeOptions, chartThemeOptions } from './chart-options';

const FONT_FAMILY = "'Onest', 'Onest Fallback'";

const { light, dark } = CHART_THEME;

function themed(palette: ChartPalette) {
  return chartThemeOptions({ palette, reduced: false, fontFamily: FONT_FAMILY });
}

function coloursOf({ scales, plugins }: ChartThemeOptions) {
  const { tooltip } = plugins;
  return {
    text: [scales.x.ticks.color, scales.y.ticks.color, plugins.legend.labels.color],
    grid: scales.y.grid.color,
    tooltip: [tooltip.backgroundColor, tooltip.titleColor, tooltip.bodyColor],
  };
}

describe('chartThemeOptions', () => {
  it.each([
    { scheme: 'light', palette: light },
    { scheme: 'dark', palette: dark },
  ])(
    'paints the $scheme theme: ink-3 text, line-soft grid, an ink tooltip with paper text',
    ({ palette }) => {
      const { colors } = palette;

      expect(coloursOf(themed(palette))).toEqual({
        text: [colors['ink-3'], colors['ink-3'], colors['ink-3']],
        grid: colors['line-soft'],
        tooltip: [colors.ink, colors.paper, colors.paper],
      });
    },
  );

  it('the dark tooltip turns light with dark text', () => {
    const { tooltip } = themed(dark).plugins;

    expect(tooltip.backgroundColor).not.toBe(light.colors.ink);
    expect(tooltip.titleColor).not.toBe(light.colors.paper);
  });

  it('keeps the grid horizontal with no tick marks and no axis borders', () => {
    const { x, y } = themed(light).scales;

    expect(x.grid).toEqual({ display: false });
    expect(y.grid.drawTicks).toBe(false);
    expect([x.border, y.border]).toEqual([{ display: false }, { display: false }]);
  });

  it('writes every canvas text in the page font family', () => {
    const { font, scales, plugins } = themed(light);

    expect([
      font,
      scales.x.ticks.font,
      scales.y.ticks.font,
      plugins.legend.labels.font,
      plugins.tooltip.titleFont,
      plugins.tooltip.bodyFont,
    ]).toEqual(Array.from({ length: 6 }, () => ({ family: FONT_FAMILY })));
  });

  it('turns every chart animation off under reduced motion and leaves it to the defaults otherwise', () => {
    const reduced = chartThemeOptions({ palette: light, reduced: true, fontFamily: FONT_FAMILY });

    expect(reduced.animation).toBe(false);
    expect('animation' in themed(light)).toBe(false);
  });
});
