import { z } from 'zod';

import { senioritySchema } from '../ai/vacancy-parse.js';
import { countSchema } from './analytics-funnel.js';

export const SALARY_OUTCOMES = ['offer', 'salary_rejection', 'other'] as const;

const usdSchema = z.int().nonnegative();

export const salaryOutcomeSchema = z.enum(SALARY_OUTCOMES);

export const salaryRangeSchema = z.object({
  applications: countSchema,
  low: usdSchema,
  median: usdSchema,
  high: usdSchema,
});

const salaryGroupSchema = <Key extends z.ZodType>(key: Key) => salaryRangeSchema.extend({ key });

export const salaryFloorSchema = z.object({
  floor: usdSchema,
  rejections: countSchema,
  below: countSchema,
  perMonthLow: countSchema,
  perMonthHigh: countSchema,
});

export const salaryResponseSchema = z.object({
  withSalary: countSchema,
  missing: countSchema,
  unconverted: countSchema,
  median: usdSchema.nullable(),
  outcomes: z.array(salaryGroupSchema(salaryOutcomeSchema)),
  seniority: z.array(salaryGroupSchema(senioritySchema)),
  stack: z.array(salaryGroupSchema(z.string())),
  floor: salaryFloorSchema.nullable(),
});

export type SalaryOutcome = z.infer<typeof salaryOutcomeSchema>;
export type SalaryRange = z.infer<typeof salaryRangeSchema>;
export type SalaryFloor = z.infer<typeof salaryFloorSchema>;
export type SalaryResponse = z.infer<typeof salaryResponseSchema>;
