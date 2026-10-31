import { z } from 'zod';

import { applicationSchema, STACK_MAX_ITEMS } from '../schemas/application.js';
import { rawTextSchema } from '../schemas/text.js';

export const VACANCY_PARSE_LIMITS = { textMaxLength: 20_000 } as const;

export const vacancyParseInputSchema = z.object({
  text: rawTextSchema(VACANCY_PARSE_LIMITS.textMaxLength),
});

export const vacancyParseOutputSchema = applicationSchema
  .pick({
    company: true,
    position: true,
    location: true,
    workMode: true,
    salaryMin: true,
    salaryMax: true,
    currency: true,
    stack: true,
  })
  .extend({
    company: applicationSchema.shape.company.nullable(),
    position: applicationSchema.shape.position.nullable(),
    stack: applicationSchema.shape.stack.max(STACK_MAX_ITEMS),
  });

export type VacancyParseInput = z.infer<typeof vacancyParseInputSchema>;
export type VacancyParseOutput = z.infer<typeof vacancyParseOutputSchema>;
