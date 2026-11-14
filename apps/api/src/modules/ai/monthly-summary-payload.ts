import {
  type ActiveStage,
  type ForecastResponse,
  type FunnelResponse,
  type InsightsResponse,
  MONTHLY_SUMMARY_LIMITS,
  type MonthlySummaryInput,
  type PlanProgress,
  type RateResult,
  type ReasonsResponse,
  type ResumeAbResponse,
  type SourcesResponse,
  THRESHOLDS,
  type YearMonth,
} from '@jobflow/shared';

import { monthNameOf, shiftMonth } from '../../common/year-month.js';

export type WhatIfSource = { stage: ActiveStage; forecast: ForecastResponse };

export type MonthlySummarySource = {
  month: YearMonth;
  funnel: FunnelResponse;
  forecast: ForecastResponse;
  whatIf: WhatIfSource | null;
  reasons: ReasonsResponse;
  sources: SourcesResponse;
  resumeAb: ResumeAbResponse;
  insights: InsightsResponse;
  previousPlan: PlanProgress | null;
};

type MonthlyKpi = FunnelResponse['kpis']['sent'];

type OkForecast = Extract<ForecastResponse, { status: 'ok' }>;

const { listMax, stagesMax, sourcesMax } = MONTHLY_SUMMARY_LIMITS;

const percentOf = (fraction: number) => Math.round(fraction * 100);

const ratePercentOf = (rate: RateResult | null) =>
  rate?.status === 'ok' ? percentOf(rate.value) : null;

const weeksOf = (weeks: number | null) => (weeks === null ? null : Math.round(weeks));

const periodOf = (month: YearMonth): MonthlySummaryInput['period'] => ({
  month,
  name: monthNameOf(month),
  previousName: monthNameOf(shiftMonth(month, -1)),
});

const monthlyCountOf = ({ thisMonth, previousMonth }: MonthlyKpi) => ({
  month: thisMonth,
  previousMonth,
  change: thisMonth - previousMonth,
});

function activityOf({ sent, interviews, offers, daysInSearch }: FunnelResponse['kpis']) {
  return {
    sent: monthlyCountOf(sent),
    interviews: monthlyCountOf(interviews),
    offers: monthlyCountOf(offers),
    daysInSearch,
  };
}

const forecastWeeksOf = ({ medianWeeks, likely }: OkForecast) => ({
  medianWeeks: weeksOf(medianWeeks),
  likelyLow: weeksOf(likely.low),
  likelyHigh: weeksOf(likely.high),
});

function forecastOf(forecast: ForecastResponse): MonthlySummaryInput['forecast'] {
  if (forecast.status !== 'ok') {
    return { status: forecast.status, have: forecast.have, need: forecast.need };
  }
  const { applicationsPerWeek, applications, offers } = forecast;
  return {
    status: 'ok',
    ...forecastWeeksOf(forecast),
    applicationsPerWeek: Math.round(applicationsPerWeek),
    applications,
    offers,
  };
}

function whatIfOf({ forecast, whatIf }: MonthlySummarySource): MonthlySummaryInput['whatIf'] {
  if (forecast.status !== 'ok' || whatIf?.forecast.status !== 'ok') {
    return null;
  }
  const conversionPercent = percentOf(THRESHOLDS.WHAT_IF_CONVERSION);
  return { stage: whatIf.stage, conversionPercent, ...forecastWeeksOf(whatIf.forecast) };
}

function resumeAbOf({ versions, comparison }: ResumeAbResponse): MonthlySummaryInput['resumeAb'] {
  if (versions.length === 0) {
    return null;
  }
  const before = ratePercentOf(comparison?.switch.before ?? null);
  const after = ratePercentOf(comparison?.switch.after ?? null);
  return {
    versions: versions.slice(0, listMax).map(({ number, applications, conversion }) => ({
      number,
      applications,
      conversionPercent: ratePercentOf(conversion),
    })),
    switch:
      comparison === null || before === null || after === null
        ? null
        : { number: comparison.challenger, beforePercent: before, afterPercent: after },
  };
}

const funnelOf = ({ stages }: FunnelResponse) =>
  stages.slice(0, stagesMax).map(({ stage, reached, passed, conversion }) => ({
    stage,
    reached,
    passed,
    conversionPercent: ratePercentOf(conversion),
  }));

const reasonsOf = ({ stages }: ReasonsResponse) =>
  stages
    .flatMap(({ top }) => (top?.status === 'ok' ? [top] : []))
    .slice(0, stagesMax)
    .map(({ stage, code, count, of }) => ({ stage, code, count, of }));

const sourcesOf = ({ sources }: SourcesResponse) =>
  sources.slice(0, sourcesMax).map(({ source, applications, screenings, conversion }) => ({
    source,
    applications,
    screenings,
    conversionPercent: ratePercentOf(conversion),
  }));

export function monthlySummaryPayload(source: MonthlySummarySource): MonthlySummaryInput {
  const { insights, actions } = source.insights;
  return {
    period: periodOf(source.month),
    activity: activityOf(source.funnel.kpis),
    funnel: funnelOf(source.funnel),
    reasons: reasonsOf(source.reasons),
    sources: sourcesOf(source.sources),
    resumeAb: resumeAbOf(source.resumeAb),
    forecast: forecastOf(source.forecast),
    whatIf: whatIfOf(source),
    insights: insights.slice(0, listMax).map(({ title, body }) => ({ title, text: body })),
    ruleActions: actions
      .slice(0, listMax)
      .map(({ title, expectedEffect }) => ({ title, expectedEffect })),
    previousPlan: source.previousPlan,
  };
}
