import type { ForecastResponse, WeeksRange } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

import { oneDecimal, percentOf } from './kpi-values';

const COPY = uk.analytics.blocks.forecast;

const PERCENT = uk.analytics.percent;

const AXIS_ENDS = [16, 32, 52] as const;

const TICK_COUNT = 4;

const FULL = 100;

const HUNDREDTHS = 100;

const MIN_WIDTH = 1.5;

export type ForecastSpan = Readonly<{ left: number; width: number }>;

export type ForecastBand = Readonly<{
  ticks: readonly string[];
  likely: ForecastSpan;
  interval: ForecastSpan;
  median: number;
}>;

export type ForecastView = Readonly<{
  headline: string;
  caption: string;
  legend: readonly string[];
  odds: string;
  note: string;
  band: ForecastBand;
}>;

export type OkForecast = Extract<ForecastResponse, { status: 'ok' }>;

export type ForecastViewInput = Readonly<{ forecast: OkForecast; improved: boolean }>;

type Axis = Readonly<{ end: number }>;

function axisEnd(likelyHigh: number | null): number {
  const last = AXIS_ENDS[AXIS_ENDS.length - 1] ?? FULL;
  if (likelyHigh === null) return last;
  return AXIS_ENDS.find((end) => end >= likelyHigh) ?? last;
}

function ticksOf({ end }: Axis): string[] {
  const step = end / TICK_COUNT;
  const inner = [1, 2, 3].map((index) => COPY.ticks.weeks(step * index));
  return [COPY.ticks.start, ...inner, COPY.ticks.end(end)];
}

function positionOf(weeks: number | null, { end }: Axis): number {
  if (weeks === null) return FULL;
  return Math.min(Math.round((weeks / end) * FULL * HUNDREDTHS) / HUNDREDTHS, FULL);
}

function spanOf(range: WeeksRange, axis: Axis): ForecastSpan {
  const start = positionOf(range.low, axis);
  const width = Math.round((positionOf(range.high, axis) - start) * HUNDREDTHS) / HUNDREDTHS;
  if (width >= MIN_WIDTH) return { left: start, width };
  return { left: Math.min(start, FULL - MIN_WIDTH), width: MIN_WIDTH };
}

function spanText(range: WeeksRange, horizon: number): string {
  if (range.low === null) return COPY.beyond(horizon);
  const low = Math.round(range.low);
  if (range.high === null) return COPY.openEnd({ low, horizon });
  const high = Math.round(range.high);
  return low === high ? COPY.weeks(low) : COPY.span(low, high);
}

function medianText({ medianWeeks, horizonWeeks }: OkForecast): string {
  return medianWeeks === null ? COPY.beyond(horizonWeeks) : COPY.fraction(oneDecimal(medianWeeks));
}

function bandOf(forecast: OkForecast): ForecastBand {
  const axis = { end: axisEnd(forecast.likely.high) };
  return {
    ticks: ticksOf(axis),
    likely: spanOf(forecast.likely, axis),
    interval: spanOf(forecast.interval, axis),
    median: positionOf(forecast.medianWeeks, axis),
  };
}

export function forecastViewOf({ forecast, improved }: ForecastViewInput): ForecastView {
  const likely = spanText(forecast.likely, forecast.horizonWeeks);
  return {
    headline: likely,
    caption: COPY.caption({ pace: oneDecimal(forecast.applicationsPerWeek), improved }),
    legend: [
      COPY.legend.likely(likely),
      COPY.legend.interval(spanText(forecast.interval, forecast.horizonWeeks)),
      COPY.legend.median(medianText(forecast)),
    ],
    odds: COPY.odds(
      PERCENT(percentOf(forecast.withinFourWeeks)),
      PERCENT(percentOf(forecast.withinEightWeeks)),
    ),
    note: COPY.note(forecast),
    band: bandOf(forecast),
  };
}
