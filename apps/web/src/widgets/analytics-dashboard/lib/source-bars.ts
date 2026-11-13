import {
  type RateResult,
  type Source,
  SOURCE_LABELS,
  type SourcePerformance,
  type SourcesResponse,
} from '@jobflow/shared';

import { withSearchParams } from '@/shared/api';
import { uk } from '@/shared/i18n';
import type { ChartTableRow } from '@/shared/ui/chart-table';

import { percentOf } from './kpi-values';
import { rateLabelOf } from './rate-label';

const BLOCKS = uk.analytics.blocks;

const COPY = BLOCKS.sources;

export type PlottedSource = Readonly<{
  source: Source;
  label: [string, string];
  value: number;
  whisker: [number, number];
  href: string;
  tip: string[];
}>;

export type SmallSource = Readonly<{ source: Source; line: string; note: string; href: string }>;

export type SourceBars = Readonly<{
  plotted: PlottedSource[];
  small: SmallSource[];
  rows: ChartTableRow[];
}>;

type MeasuredRate = Extract<RateResult, { status: 'ok' }>;

type MeasuredSource = Readonly<{ row: SourcePerformance; rate: MeasuredRate }>;

const nameOf = (source: Source) => SOURCE_LABELS[source].labelUk;

const boardHrefOf = (source: Source) => withSearchParams('/board', { source: [source] });

const countsOf = ({ applications, screenings }: SourcePerformance) => ({
  applied: applications,
  screened: screenings,
});

function plottedOf({ row, rate }: MeasuredSource): PlottedSource {
  const value = percentOf(rate.value);
  const low = percentOf(rate.low);
  const high = percentOf(rate.high);
  return {
    source: row.source,
    label: [nameOf(row.source), uk.analytics.search.applications(row.applications)],
    value,
    whisker: [low, high],
    href: boardHrefOf(row.source),
    tip: [
      BLOCKS.sankey.tooltip.conversion({ step: COPY.step, value, low, high }),
      COPY.counts(countsOf(row)),
    ],
  };
}

function smallOf(row: SourcePerformance): SmallSource {
  return {
    source: row.source,
    line: COPY.small.line({ label: nameOf(row.source), ...countsOf(row) }),
    note: row.note ?? COPY.small.noise,
    href: boardHrefOf(row.source),
  };
}

function rowOf(row: SourcePerformance): ChartTableRow {
  return {
    key: row.source,
    cells: [
      { text: nameOf(row.source), href: boardHrefOf(row.source) },
      { text: String(row.applications) },
      { text: String(row.screenings) },
      { text: rateLabelOf(row.conversion) },
    ],
  };
}

export function sourceBarsOf({ sources }: SourcesResponse): SourceBars {
  return {
    plotted: sources.flatMap((row) =>
      row.conversion.status === 'ok' ? [plottedOf({ row, rate: row.conversion })] : [],
    ),
    small: sources.filter((row) => row.conversion.status !== 'ok').map(smallOf),
    rows: sources.map(rowOf),
  };
}
