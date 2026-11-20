import type { RateResult } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { percentOf } from '@/shared/lib/percent';

const TOOLTIP = uk.analytics.blocks.sankey.tooltip;

const AXIS_STEP = 20;

const FULL_AXIS = 100;

export type MeasuredRate = Extract<RateResult, { status: 'ok' }>;

export type RateBar = Readonly<{
  value: number;
  low: number;
  high: number;
  whisker: [number, number];
}>;

export type ConversionTipInput = Readonly<{ step: string; bar: RateBar }>;

export function rateBarOf(rate: MeasuredRate): RateBar {
  const low = percentOf(rate.low);
  const high = percentOf(rate.high);
  return { value: percentOf(rate.value), low, high, whisker: [low, high] };
}

export function conversionTipOf({ step, bar: { value, low, high } }: ConversionTipInput): string {
  return TOOLTIP.conversion({ step, value, low, high });
}

export function percentAxisMaxOf(bars: readonly Pick<RateBar, 'whisker'>[]): number {
  const highest = Math.max(AXIS_STEP, ...bars.map(({ whisker: [, high] }) => high));
  return Math.min(FULL_AXIS, Math.ceil(highest / AXIS_STEP) * AXIS_STEP);
}
