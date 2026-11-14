import { z } from 'zod';

import { rejectionReasonCodeSchema } from '../rejection-reasons.js';
import { countSchema, insufficientDataSchema } from '../schemas/analytics-funnel.js';
import { resumeAbComparisonSchema } from '../schemas/analytics-resume-ab.js';
import { sourcePerformanceSchema } from '../schemas/analytics-sources.js';
import { planProgressSchema } from '../schemas/plan.js';
import { yearMonthSchema } from '../schemas/year-month.js';
import { SOURCES } from '../sources.js';
import { activeStageSchema, STAGES, stageSchema } from '../stages.js';

export const MONTHLY_SUMMARY_LIMITS = {
  wordsMax: 120,
  actionsMax: 4,
  summaryMaxLength: 1000,
  titleMaxLength: 120,
  whyMaxLength: 300,
  effectMaxLength: 200,
  metricMaxLength: 120,
  monthNameMaxLength: 20,
  insightTextMaxLength: 500,
  stagesMax: STAGES.length,
  sourcesMax: SOURCES.length,
  listMax: 10,
} as const;

const percentSchema = z.int().min(0).max(100);
const weeksSchema = z.int().nonnegative();
const monthNameSchema = z.string().min(1).max(MONTHLY_SUMMARY_LIMITS.monthNameMaxLength);
const insightTextSchema = z.string().min(1).max(MONTHLY_SUMMARY_LIMITS.insightTextMaxLength);
const versionNumberSchema = resumeAbComparisonSchema.shape.challenger;

const monthlyCountSchema = z.object({
  month: countSchema,
  previousMonth: countSchema,
  change: z.int(),
});

const forecastWeeksSchema = z.object({
  medianWeeks: weeksSchema.nullable(),
  likelyLow: weeksSchema.nullable(),
  likelyHigh: weeksSchema.nullable(),
});

const summaryForecastSchema = z.discriminatedUnion('status', [
  forecastWeeksSchema.extend({
    status: z.literal('ok'),
    applicationsPerWeek: countSchema,
    applications: countSchema,
    offers: countSchema,
  }),
  insufficientDataSchema.omit({ message: true }),
]);

const summaryResumeAbSchema = z.object({
  versions: z
    .array(
      z.object({
        number: versionNumberSchema,
        applications: countSchema,
        conversionPercent: percentSchema.nullable(),
      }),
    )
    .max(MONTHLY_SUMMARY_LIMITS.listMax),
  switch: z
    .object({
      number: versionNumberSchema,
      beforePercent: percentSchema,
      afterPercent: percentSchema,
    })
    .nullable(),
});

export const monthlySummaryInputSchema = z.object({
  period: z.object({
    month: yearMonthSchema,
    name: monthNameSchema,
    previousName: monthNameSchema,
  }),
  activity: z.object({
    sent: monthlyCountSchema,
    interviews: monthlyCountSchema,
    offers: monthlyCountSchema,
    daysInSearch: countSchema,
  }),
  funnel: z
    .array(
      z.object({
        stage: stageSchema,
        reached: countSchema,
        passed: countSchema.nullable(),
        conversionPercent: percentSchema.nullable(),
      }),
    )
    .max(MONTHLY_SUMMARY_LIMITS.stagesMax),
  reasons: z
    .array(
      z.object({
        stage: stageSchema,
        code: rejectionReasonCodeSchema,
        count: z.int().positive(),
        of: z.int().positive(),
      }),
    )
    .max(MONTHLY_SUMMARY_LIMITS.stagesMax),
  sources: z
    .array(
      sourcePerformanceSchema
        .pick({ source: true, applications: true, screenings: true })
        .extend({ conversionPercent: percentSchema.nullable() }),
    )
    .max(MONTHLY_SUMMARY_LIMITS.sourcesMax),
  resumeAb: summaryResumeAbSchema.nullable(),
  forecast: summaryForecastSchema,
  whatIf: forecastWeeksSchema
    .extend({ stage: activeStageSchema, conversionPercent: percentSchema })
    .nullable(),
  insights: z
    .array(z.object({ title: insightTextSchema, text: insightTextSchema }))
    .max(MONTHLY_SUMMARY_LIMITS.listMax),
  ruleActions: z
    .array(z.object({ title: insightTextSchema, expectedEffect: insightTextSchema }))
    .max(MONTHLY_SUMMARY_LIMITS.listMax),
  previousPlan: planProgressSchema.nullable(),
});

const actionTextSchema = (maxLength: number) => z.string().min(1).max(maxLength);

export const monthlySummaryActionSchema = z.object({
  title: actionTextSchema(MONTHLY_SUMMARY_LIMITS.titleMaxLength),
  why: actionTextSchema(MONTHLY_SUMMARY_LIMITS.whyMaxLength),
  expectedEffect: actionTextSchema(MONTHLY_SUMMARY_LIMITS.effectMaxLength),
  metric: actionTextSchema(MONTHLY_SUMMARY_LIMITS.metricMaxLength),
});

export const monthlySummaryOutputSchema = z.object({
  summary: actionTextSchema(MONTHLY_SUMMARY_LIMITS.summaryMaxLength),
  actions: z.array(monthlySummaryActionSchema).min(1).max(MONTHLY_SUMMARY_LIMITS.actionsMax),
});

export type MonthlySummaryInput = z.infer<typeof monthlySummaryInputSchema>;
export type MonthlySummaryAction = z.infer<typeof monthlySummaryActionSchema>;
export type MonthlySummaryOutput = z.infer<typeof monthlySummaryOutputSchema>;
