import {
  AUTH_ROUTES,
  type Source,
  SOURCE_LABELS,
  type SourcePerformance,
  type SourcesResponse,
} from '@jobflow/shared';

import { withSearchParams } from '@/shared/api';
import { uk } from '@/shared/i18n';
import type { ChartTableRow } from '@/shared/ui/chart-table';

import { conversionRowOf, type EvidenceView, percentScaleOf } from './interval-bars';
import { conversionTipOf, type MeasuredRate, rateBarOf } from './rate-bar';

const ANALYTICS = uk.analytics;

const COPY = ANALYTICS.blocks.sources;

const TABLE = COPY.table;

const FULL_AXIS = 100;

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

type MeasuredSource = Readonly<{ row: SourcePerformance; rate: MeasuredRate }>;

const nameOf = (source: Source) => SOURCE_LABELS[source].labelUk;

const boardHrefOf = (source: Source) => withSearchParams(AUTH_ROUTES.home, { source: [source] });

const countsOf = ({ applications, screenings }: SourcePerformance) => ({
  applied: applications,
  screened: screenings,
});

function plottedOf({ row, rate }: MeasuredSource): PlottedSource {
  const bar = rateBarOf(rate);
  return {
    source: row.source,
    label: [nameOf(row.source), ANALYTICS.search.applications(row.applications)],
    value: bar.value,
    whisker: bar.whisker,
    href: boardHrefOf(row.source),
    tip: [conversionTipOf({ step: COPY.step, bar }), COPY.counts(countsOf(row))],
  };
}

function smallOf(row: SourcePerformance): SmallSource {
  return {
    source: row.source,
    line: COPY.small.line({ label: nameOf(row.source), ...countsOf(row) }),
    note: row.note ?? ANALYTICS.small.noise,
    href: boardHrefOf(row.source),
  };
}

function rowOf(row: SourcePerformance): ChartTableRow {
  return conversionRowOf({
    key: row.source,
    name: nameOf(row.source),
    href: boardHrefOf(row.source),
    applications: row.applications,
    screenings: row.screenings,
    conversion: row.conversion,
  });
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

export function sourcesViewOf(response: SourcesResponse): EvidenceView {
  const { plotted, small, rows } = sourceBarsOf(response);
  if (rows.length === 0) return { status: 'empty', content: COPY.empty };
  return {
    status: 'plotted',
    chart: {
      rows: plotted,
      names: { series: TABLE.conversion, caption: TABLE.caption },
      scale: percentScaleOf(FULL_AXIS),
    },
    notes: [],
    small: small.map(({ source, line, note }) => ({ key: source, text: `${line} ${note}` })),
    table: {
      caption: TABLE.caption,
      heads: [TABLE.source, TABLE.applications, TABLE.screenings, TABLE.conversion],
      rows,
    },
  };
}
