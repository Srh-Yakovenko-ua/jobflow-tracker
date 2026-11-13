import type { CHART_THEME } from '@jobflow/shared/chart-theme';

export type ChartPalette = (typeof CHART_THEME)['light' | 'dark'];

export type ChartThemeInput = Readonly<{
  palette: ChartPalette;
  reduced: boolean;
  fontFamily: string;
}>;

function themedOptions({ palette, fontFamily }: Omit<ChartThemeInput, 'reduced'>) {
  const { colors } = palette;
  const font = { family: fontFamily };
  const ticks = { color: colors['ink-3'], font };
  return {
    font,
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks },
      y: {
        grid: { color: colors['line-soft'], drawTicks: false },
        border: { display: false },
        ticks,
      },
    },
    plugins: {
      legend: { labels: { color: colors['ink-3'], font } },
      tooltip: {
        backgroundColor: colors.ink,
        titleColor: colors.paper,
        bodyColor: colors.paper,
        titleFont: font,
        bodyFont: font,
      },
    },
  };
}

export type ChartThemeOptions = ReturnType<typeof themedOptions> & { animation?: false };

export function chartThemeOptions({ reduced, ...look }: ChartThemeInput): ChartThemeOptions {
  const options = themedOptions(look);
  return reduced ? { ...options, animation: false } : options;
}
