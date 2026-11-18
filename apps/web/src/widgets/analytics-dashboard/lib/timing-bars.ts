import {
  type ActiveStage,
  AUTH_ROUTES,
  STAGE_LABELS,
  type StageTiming,
  type TimingsResponse,
} from '@jobflow/shared';

import { withSearchParams } from '@/shared/api';
import { uk } from '@/shared/i18n';
import type { ChartTableRow } from '@/shared/ui/chart-table';

import {
  type DataColour,
  DRAWN_LOOK,
  type EvidenceView,
  insufficientOf,
  type InsufficientState,
  type IntervalBarRow,
  type NoteLine,
} from './interval-bars';

const ANALYTICS = uk.analytics;

const COPY = ANALYTICS.blocks.timings;

const TABLE = COPY.table;

const AXIS_STEP = 5;

const DAYS = new Intl.NumberFormat(uk.locale, { maximumFractionDigits: 1 });

const STAGE_COLOURS: Record<ActiveStage, DataColour> = {
  applied: 0,
  screening: 1,
  tech_interview: 2,
  final: 4,
};

type MeasuredTiming = Extract<StageTiming, { status: 'ok' }>;

type ShortTiming = Exclude<StageTiming, MeasuredTiming>;

const nameOf = (stage: ActiveStage) => STAGE_LABELS[stage].labelUk;

const boardHrefOf = (stage: ActiveStage) => withSearchParams(AUTH_ROUTES.home, { stage: [stage] });

const shown = (days: number) => DAYS.format(days);

const daysOf = (days: number) => COPY.days(shown(days), days);

function barOf(timing: MeasuredTiming): IntervalBarRow {
  const { stage, medianDays, lowerQuartileDays, upperQuartileDays } = timing;
  return {
    label: [nameOf(stage)],
    value: medianDays,
    whisker: [lowerQuartileDays, upperQuartileDays],
    tip: [
      COPY.median(daysOf(medianDays)),
      COPY.typical(shown(lowerQuartileDays), daysOf(upperQuartileDays)),
    ],
    href: boardHrefOf(stage),
    colour: STAGE_COLOURS[stage],
  };
}

function smallOf({ stage, have, message }: ShortTiming): NoteLine {
  return { key: stage, text: `${COPY.small(nameOf(stage), have)} ${message}` };
}

function cellsOf(timing: StageTiming): string[] {
  if (timing.status !== 'ok') {
    return [ANALYTICS.lowData(timing.message), ANALYTICS.noValue, String(timing.have)];
  }
  const range = `${shown(timing.lowerQuartileDays)}–${shown(timing.upperQuartileDays)}`;
  return [shown(timing.medianDays), range, String(timing.samples)];
}

function rowOf(timing: StageTiming): ChartTableRow {
  const cells = cellsOf(timing).map((text) => ({ text }));
  return {
    key: timing.stage,
    cells: [{ text: nameOf(timing.stage), href: boardHrefOf(timing.stage) }, ...cells],
  };
}

const isMeasured = (timing: StageTiming): timing is MeasuredTiming => timing.status === 'ok';

const isShort = (timing: StageTiming): timing is ShortTiming => timing.status !== 'ok';

export function timingBarsOf({ stages }: TimingsResponse): EvidenceView {
  if (stages.length === 0) return { status: 'empty', content: COPY.empty };
  return {
    status: 'plotted',
    chart: {
      rows: stages.filter(isMeasured).map(barOf),
      names: { series: COPY.series, caption: TABLE.caption },
      scale: { step: AXIS_STEP, tick: shown, format: daysOf },
      look: DRAWN_LOOK.timings,
    },
    notes: [],
    small: stages.filter(isShort).map(smallOf),
    table: {
      caption: TABLE.caption,
      heads: [TABLE.stage, TABLE.median, TABLE.typical, TABLE.samples],
      rows: stages.map(rowOf),
    },
  };
}

export function timingsLowOf({ stages }: TimingsResponse): InsufficientState | undefined {
  const [first] = stages;
  if (first === undefined || first.status === 'ok' || stages.some(isMeasured)) return undefined;
  return insufficientOf(first);
}
