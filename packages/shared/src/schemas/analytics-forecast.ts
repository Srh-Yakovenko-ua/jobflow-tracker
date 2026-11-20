import { z } from 'zod';

import { activeStageSchema } from '../stages.js';
import { countSchema, fractionSchema, insufficientDataSchema } from './analytics-funnel.js';
import { sourcesQuerySchema } from './analytics-sources.js';

const weeksSchema = z.number().nonnegative();

const isConversion = (improve: string) => {
  const conversion = Number(improve.slice(improve.indexOf(':') + 1));
  return conversion > 0 && conversion <= 1;
};

export const forecastQuerySchema = sourcesQuerySchema.extend({
  applicationsPerWeek: z.number().nonnegative().optional(),
  improve: z
    .templateLiteral([activeStageSchema, ':', z.number()])
    .refine(isConversion, 'must be an active stage and a conversion in (0, 1]')
    .optional(),
});

export const weeksRangeSchema = z.object({
  low: weeksSchema.nullable(),
  high: weeksSchema.nullable(),
});

export const forecastResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    medianWeeks: weeksSchema.nullable(),
    likely: weeksRangeSchema,
    interval: weeksRangeSchema,
    withinFourWeeks: fractionSchema,
    withinEightWeeks: fractionSchema,
    applicationsPerWeek: z.number().nonnegative(),
    applications: countSchema,
    offers: countSchema,
    horizonWeeks: z.int().positive(),
  }),
  insufficientDataSchema,
]);

export type ForecastQuery = z.infer<typeof forecastQuerySchema>;
export type WeeksRange = z.infer<typeof weeksRangeSchema>;
export type ForecastResponse = z.infer<typeof forecastResponseSchema>;
