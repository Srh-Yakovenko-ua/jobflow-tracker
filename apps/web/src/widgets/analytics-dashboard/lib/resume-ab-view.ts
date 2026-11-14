import type { ResumeAbComparison, ResumeAbResponse, ResumeAbVersion } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { formatDayMonth } from '@/shared/lib/state-format';
import type { ChartFrameHeader } from '@/shared/ui/chart-frame';

import {
  conversionRowOf,
  type DataColour,
  DRAWN_LOOK,
  type EvidenceView,
  type InsufficientState,
  type IntervalBarRow,
  type NoteLine,
  percentScaleOf,
  rangeTipOf,
} from './interval-bars';
import { percentOf } from './kpi-values';
import { type MeasuredRate, percentAxisMaxOf, rateBarOf } from './rate-bar';
import { rateLabelOf } from './rate-label';

const ANALYTICS = uk.analytics;

const COPY = ANALYTICS.blocks.resume_ab;

const HEADS = ANALYTICS.blocks.sources.table;

const CHALLENGER: DataColour = 1;

const BASELINE: DataColour = 4;

const OTHER: DataColour = 2;

export type ResumeAbInput = Readonly<{ data: ResumeAbResponse; timeZone: string }>;

type MeasuredVersion = Readonly<{ version: ResumeAbVersion; rate: MeasuredRate }>;

type PairInput = Readonly<{ comparison: ResumeAbComparison; timeZone: string }>;

function colourOf(number: number, comparison: ResumeAbComparison): DataColour {
  if (number === comparison.challenger) return CHALLENGER;
  return number === comparison.baseline ? BASELINE : OTHER;
}

function measuredOf(versions: readonly ResumeAbVersion[]): MeasuredVersion[] {
  return versions.flatMap((version) =>
    version.conversion.status === 'ok' ? [{ version, rate: version.conversion }] : [],
  );
}

function barOf({ version, rate }: MeasuredVersion, comparison: ResumeAbComparison): IntervalBarRow {
  const bar = rateBarOf(rate);
  return {
    ...bar,
    label: [COPY.label(version)],
    tip: [COPY.tip({ ...rate, value: bar.value }), rangeTipOf(bar)],
    colour: colourOf(version.number, comparison),
  };
}

function notesOf({ comparison, timeZone }: PairInput): NoteLine[] {
  const { challenger, baseline } = comparison;
  const percent = percentOf(comparison.probabilityBetter);
  const date = formatDayMonth({ at: new Date(comparison.switch.at), timeZone });
  return [
    { key: 'probability', text: COPY.probability({ challenger, baseline, percent }) },
    {
      key: 'switch',
      text: COPY.switched({
        number: challenger,
        date,
        before: rateLabelOf(comparison.switch.before),
        after: rateLabelOf(comparison.switch.after),
      }),
    },
  ];
}

function smallOf(version: ResumeAbVersion): NoteLine {
  const { number, applications, screenings } = version;
  const line = COPY.small({ number, applied: applications, screened: screenings });
  return { key: `v${String(number)}`, text: `${line} ${ANALYTICS.small.noise}` };
}

function tableRowOf(version: ResumeAbVersion) {
  return conversionRowOf({
    key: `v${String(version.number)}`,
    name: COPY.label(version),
    ...version,
  });
}

function plottedOf(
  { data, timeZone }: ResumeAbInput,
  comparison: ResumeAbComparison,
): EvidenceView {
  const rows = measuredOf(data.versions).map((measured) => barOf(measured, comparison));
  return {
    status: 'plotted',
    chart: {
      rows,
      names: { series: HEADS.conversion, caption: COPY.table.caption },
      scale: percentScaleOf(percentAxisMaxOf(rows)),
      look: DRAWN_LOOK.resumeAb,
    },
    notes: notesOf({ comparison, timeZone }),
    small: data.versions.filter((version) => version.conversion.status !== 'ok').map(smallOf),
    table: {
      caption: COPY.table.caption,
      heads: [COPY.table.version, HEADS.applications, HEADS.screenings, HEADS.conversion],
      rows: data.versions.map(tableRowOf),
    },
  };
}

export function resumeAbViewOf(input: ResumeAbInput): EvidenceView {
  const { versions, comparison } = input.data;
  if (versions.length === 0) return { status: 'empty', content: COPY.empty.none };
  if (comparison === null) return { status: 'empty', content: COPY.empty.single };
  return plottedOf(input, comparison);
}

export function resumeAbLowOf({ comparison }: ResumeAbResponse): InsufficientState | undefined {
  return comparison?.verdict.status === 'insufficient_data' ? comparison.verdict : undefined;
}

export function resumeAbHeaderOf(data: ResumeAbResponse | undefined): ChartFrameHeader {
  const verdict = data?.comparison?.verdict;
  return {
    eyebrow: COPY.eyebrow,
    title: verdict?.status === 'ok' ? verdict.message : COPY.fallback,
  };
}
