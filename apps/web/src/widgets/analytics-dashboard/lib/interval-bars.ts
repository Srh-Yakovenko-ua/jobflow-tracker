import type { RateResult } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import type { ChartFrameState } from '@/shared/ui/chart-frame';
import type { ChartTableRow } from '@/shared/ui/chart-table';
import type { EmptyStateContent } from '@/shared/ui/empty-state';

import { type RateBar } from './rate-bar';
import { rateLabelOf } from './rate-label';

const ANALYTICS = uk.analytics;

export type DataColour = 0 | 1 | 2 | 3 | 4 | 5;

export type IntervalBarRow = Readonly<{
  label: readonly [string, ...string[]];
  value: number;
  whisker: [number, number];
  tip: readonly string[];
  href?: string;
  colour?: DataColour;
}>;

export type IntervalScale = Readonly<{
  max?: number;
  step?: number;
  tick: (value: number) => string;
  format: (value: number) => string;
}>;

export type IntervalLook = Readonly<{ radius: number; thickness: number; height: string }>;

export type IntervalBars = Readonly<{
  rows: readonly IntervalBarRow[];
  names: Readonly<{ series: string; caption: string }>;
  scale: IntervalScale;
  look?: IntervalLook;
}>;

export type NoteLine = Readonly<{ key: string; text: string }>;

export type EvidenceTable = Readonly<{
  caption: string;
  heads: readonly string[];
  rows: readonly ChartTableRow[];
}>;

export type PlottedEvidence = Readonly<{
  status: 'plotted';
  chart: IntervalBars;
  notes: readonly NoteLine[];
  small: readonly NoteLine[];
  table: EvidenceTable;
}>;

export type EvidenceView =
  Readonly<{ status: 'empty'; content: EmptyStateContent }> | PlottedEvidence;

export type InsufficientState = Extract<ChartFrameState, { status: 'insufficient_data' }>;

export type ConversionRowInput = Readonly<{
  key: string;
  name: string;
  href?: string;
  applications: number;
  screenings: number;
  conversion: RateResult;
}>;

export const DRAWN_LOOK = {
  resumeAb: { radius: 8, thickness: 40, height: 'h-42' },
  timings: { radius: 8, thickness: 26, height: 'h-44' },
} as const satisfies Record<string, IntervalLook>;

export function percentScaleOf(max: number): IntervalScale {
  return { max, tick: ANALYTICS.percent, format: ANALYTICS.percent };
}

export function rangeTipOf({ low, high }: RateBar): string {
  return ANALYTICS.interval.range(low, high);
}

export function conversionRowOf(input: ConversionRowInput): ChartTableRow {
  return {
    key: input.key,
    cells: [
      { text: input.name, href: input.href },
      { text: String(input.applications) },
      { text: String(input.screenings) },
      { text: rateLabelOf(input.conversion) },
    ],
  };
}

export function insufficientOf({ have, need, message }: InsufficientState): InsufficientState {
  return { status: 'insufficient_data', have, need, message };
}
