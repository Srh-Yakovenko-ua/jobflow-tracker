import type { MatchStatistics, MatchValidationResponse, ScoreBucket } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import type { ChartFrameHeader } from '@/shared/ui/chart-frame';
import type { ChartTableRow } from '@/shared/ui/chart-table';

import {
  DRAWN_LOOK,
  type EvidenceView,
  insufficientOf,
  type InsufficientState,
  type IntervalBarRow,
  type NoteLine,
  percentScaleOf,
} from './interval-bars';
import { conversionTipOf, type MeasuredRate, percentAxisMaxOf, rateBarOf } from './rate-bar';
import { rateLabelOf } from './rate-label';

const ANALYTICS = uk.analytics;

const COPY = ANALYTICS.blocks.matchValidation;

const TABLE = COPY.table;

const CORRELATION = new Intl.NumberFormat(uk.locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type MeasuredBucket = Readonly<{ bucket: ScoreBucket; rate: MeasuredRate }>;

const nameOf = ({ bucket }: ScoreBucket) => COPY.buckets[bucket];

function measuredOf(buckets: readonly ScoreBucket[]): MeasuredBucket[] {
  return buckets.flatMap((bucket) =>
    bucket.interview.status === 'ok' ? [{ bucket, rate: bucket.interview }] : [],
  );
}

function barOf({ bucket, rate }: MeasuredBucket): IntervalBarRow {
  const bar = rateBarOf(rate);
  return {
    ...bar,
    label: [nameOf(bucket), ANALYTICS.search.applications(bucket.applications)],
    tip: [
      conversionTipOf({ step: COPY.step, bar }),
      ANALYTICS.kpi.screening.of(rate.successes, rate.trials),
    ],
  };
}

function statisticsNoteOf(statistics: MatchStatistics): NoteLine {
  if (statistics.status !== 'ok') return { key: 'statistics', text: statistics.message };
  const correlation = CORRELATION.format(statistics.correlation);
  return { key: 'statistics', text: COPY.correlation(correlation, statistics.applications) };
}

function notesOf({ statistics, unscored }: MatchValidationResponse): NoteLine[] {
  const left = unscored > 0 ? [{ key: 'unscored', text: COPY.unscored(unscored) }] : [];
  return [statisticsNoteOf(statistics), ...left];
}

function smallOf(bucket: ScoreBucket): NoteLine {
  const line = COPY.small(nameOf(bucket), bucket.applications);
  return { key: bucket.bucket, text: `${line} ${ANALYTICS.small.noise}` };
}

function rowOf(bucket: ScoreBucket): ChartTableRow {
  return {
    key: bucket.bucket,
    cells: [
      { text: nameOf(bucket) },
      { text: String(bucket.applications) },
      { text: rateLabelOf(bucket.screening) },
      { text: rateLabelOf(bucket.interview) },
    ],
  };
}

export function matchBarsOf(data: MatchValidationResponse): EvidenceView {
  if (data.scored === 0) return { status: 'empty', content: COPY.empty };
  const rows = measuredOf(data.buckets).map(barOf);
  return {
    status: 'plotted',
    chart: {
      rows,
      names: { series: COPY.series, caption: TABLE.caption },
      scale: percentScaleOf(percentAxisMaxOf(rows)),
      look: DRAWN_LOOK.timings,
    },
    notes: notesOf(data),
    small: data.buckets.filter((bucket) => bucket.interview.status !== 'ok').map(smallOf),
    table: {
      caption: TABLE.caption,
      heads: [TABLE.bucket, TABLE.applications, TABLE.screening, TABLE.interview],
      rows: data.buckets.map(rowOf),
    },
  };
}

function largestOf(buckets: readonly ScoreBucket[]): ScoreBucket | undefined {
  return buckets.reduce<ScoreBucket | undefined>(
    (largest, bucket) =>
      largest === undefined || bucket.applications > largest.applications ? bucket : largest,
    undefined,
  );
}

export function matchLowOf(data: MatchValidationResponse): InsufficientState | undefined {
  if (data.scored === 0 || measuredOf(data.buckets).length > 0) return undefined;
  if (data.statistics.status === 'insufficient_data') return insufficientOf(data.statistics);
  const interview = largestOf(data.buckets)?.interview;
  return interview?.status === 'insufficient_data' ? insufficientOf(interview) : undefined;
}

export function matchHeaderOf(data: MatchValidationResponse | undefined): ChartFrameHeader {
  const statistics = data?.statistics;
  return {
    eyebrow: COPY.eyebrow,
    title: statistics?.status === 'ok' ? statistics.message : COPY.fallback,
  };
}
