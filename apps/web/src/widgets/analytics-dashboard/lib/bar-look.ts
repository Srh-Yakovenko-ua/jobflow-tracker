import type { ChartEvent } from 'chart.js';

import type { ChartPalette } from '@/shared/lib/chart';

export type BarHit = Readonly<{ index: number }>;

export type BarPress = Readonly<{
  hrefAt: (index: number) => string | undefined;
  onBar: (href: string) => void;
}>;

export type BarActions = Pick<BarPress, 'onBar'>;

export type BarLookInput = Readonly<{ palette: ChartPalette; press: BarPress }>;

const TICKS = { padding: 6 };

export function barLookOf({ palette, press }: BarLookInput) {
  return {
    indexAxis: 'y' as const,
    maintainAspectRatio: false,
    onClick: (event: ChartEvent, elements: readonly BarHit[]) => {
      const [hit] = elements;
      const href = hit === undefined ? undefined : press.hrefAt(hit.index);
      if (href !== undefined) press.onBar(href);
    },
    onHover: (event: ChartEvent, elements: readonly BarHit[]) => {
      const target = event.native?.target;
      if (target instanceof HTMLElement) target.style.cursor = elements.length > 0 ? 'pointer' : '';
    },
    scales: {
      x: {
        grid: { display: true, color: palette.colors['line-soft'], drawTicks: false },
        ticks: TICKS,
      },
      y: { grid: { display: false }, ticks: TICKS },
    },
  };
}

export type BarLook = ReturnType<typeof barLookOf>;
