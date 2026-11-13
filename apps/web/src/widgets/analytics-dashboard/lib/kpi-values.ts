import {
  countedUk,
  DAY_FORMS_UK,
  type FunnelKpis,
  type FunnelResponse,
  type GhostRateVsMarket,
  pluralUk,
  type TimingsResponse,
} from '@jobflow/shared';

import { uk } from '@/shared/i18n';

const COPY = uk.analytics;

const KPI = COPY.kpi;

const PERCENT = 100;

const DAYS_IN_WEEK = 7;

const HOURS_IN_DAY = 24;

const SILENCE_MARK = 0.5;

const ONE_DECIMAL = new Intl.NumberFormat(uk.locale, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export type KpiChip = Readonly<{ text: string; tone: 'positive' | 'neutral' }>;

export type KpiBarTone = 'screening' | 'response' | 'ghost';

export type KpiBar = Readonly<{ share: number; tone: KpiBarTone; marker?: number }>;

export type KpiContent = Readonly<{
  value: string;
  caption: string;
  unit?: string;
  chip?: KpiChip;
  bar?: KpiBar;
  quiet?: true;
}>;

export type ResponseKpiInput = Readonly<{ timings: TimingsResponse; silenceDays: number }>;

export const percentOf = (fraction: number) => Math.round(fraction * PERCENT);

export function searchWeeks(daysInSearch: number): number {
  return Math.max(1, Math.round(daysInSearch / DAYS_IN_WEEK));
}

export function sentKpi({ sent, daysInSearch }: FunnelKpis): KpiContent {
  const change = sent.thisMonth - sent.previousMonth;
  const weeks = Math.max(daysInSearch, DAYS_IN_WEEK) / DAYS_IN_WEEK;
  const pace = KPI.sent.pace(ONE_DECIMAL.format(sent.total / weeks));
  if (change === 0) return { value: String(sent.total), caption: pace };
  const tone = change > 0 ? 'positive' : 'neutral';
  return {
    value: String(sent.total),
    caption: pace,
    chip: { text: KPI.sent.change(change), tone },
  };
}

const lowDataKpi = (...details: string[]): KpiContent => ({
  value: COPY.noValue,
  caption: COPY.lowData(...details),
});

export function screeningKpi(funnel: FunnelResponse): KpiContent {
  const rate = funnel.stages.find((stage) => stage.stage === 'applied')?.conversion;
  if (!rate) return lowDataKpi();
  if (rate.status !== 'ok') return lowDataKpi(rate.message);
  return {
    value: COPY.percent(percentOf(rate.value)),
    caption: KPI.screening.of(rate.successes, rate.trials),
    bar: { share: rate.value, tone: 'screening' },
  };
}

export function responseKpi({ timings, silenceDays }: ResponseKpiInput): KpiContent {
  const response = timings.responseTime;
  if (response.status !== 'ok') return lowDataKpi(response.message);
  const days = Math.round(response.hours / HOURS_IN_DAY);
  return {
    value: String(days),
    unit: pluralUk(days, DAY_FORMS_UK),
    caption: KPI.response.threshold(countedUk(silenceDays, DAY_FORMS_UK)),
    bar: {
      share: Math.min(days / (silenceDays / SILENCE_MARK), 1),
      tone: 'response',
      marker: SILENCE_MARK,
    },
  };
}

function gapChipOf(gap: GhostRateVsMarket['gap']): KpiChip | undefined {
  if (gap === null || gap.position === 'within') return undefined;
  return gap.position === 'below'
    ? { text: KPI.ghost.gap(-gap.points), tone: 'positive' }
    : { text: KPI.ghost.gap(gap.points), tone: 'neutral' };
}

export function ghostKpi({ ghostRate }: TimingsResponse): KpiContent {
  const { rate, market, gap } = ghostRate;
  const caption = KPI.ghost.market(percentOf(market.low), percentOf(market.high));
  if (rate.status !== 'ok') return lowDataKpi(rate.message, caption);
  const chip = gapChipOf(gap);
  return {
    value: COPY.percent(percentOf(rate.value)),
    caption,
    bar: { share: rate.value, tone: 'ghost' },
    quiet: true,
    ...(chip && { chip }),
  };
}
