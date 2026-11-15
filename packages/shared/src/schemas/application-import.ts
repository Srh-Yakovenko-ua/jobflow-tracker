import { z } from 'zod';

import { rejectionReasonCodeSchema } from '../rejection-reasons.js';
import { sourceSchema } from '../sources.js';
import { stageSchema } from '../stages.js';
import {
  applicationFieldsSchema,
  SALARY_ORDER_ISSUE,
  salaryRangeIsOrdered,
} from './application.js';
import { REASON_STAGE_ISSUE, reasonFitsStage } from './stage-event.js';

export const IMPORT_FIELDS = [
  'company',
  'position',
  'source',
  'appliedAt',
  'stage',
  'salary',
  'url',
  'stageHistory',
] as const;

export const importFieldSchema = z.enum(IMPORT_FIELDS);

export type ImportField = z.infer<typeof importFieldSchema>;

export const REQUIRED_IMPORT_FIELDS = [
  'company',
  'position',
  'appliedAt',
] as const satisfies readonly ImportField[];

export const IMPORT_LIMITS = {
  rowsMax: 500,
  previewRows: 10,
  fileMaxBytes: 1_000_000,
  historyMax: 100,
} as const;

export const FUTURE_DATE_ISSUE = { error: 'The date must not be in the future' } as const;

function pastInstantSchemaAt(now: Date) {
  return z.iso
    .datetime({ abort: true })
    .refine((iso) => Date.parse(iso) <= now.getTime(), FUTURE_DATE_ISSUE);
}

type DatedEvent = { occurredAt: string };

function refuseEarlierEvents(history: readonly DatedEvent[], context: z.RefinementCtx): void {
  history.forEach((event, index) => {
    const previous = history[index - 1];
    if (previous === undefined || Date.parse(previous.occurredAt) <= Date.parse(event.occurredAt)) {
      return;
    }
    context.addIssue({
      code: 'custom',
      message: `occurredAt must not be before the previous event at ${previous.occurredAt}`,
      path: [index, 'occurredAt'],
      input: event.occurredAt,
    });
  });
}

function stageHistorySchemaAt(now: Date) {
  const eventSchema = z
    .object({
      toStage: stageSchema,
      reasonCode: rejectionReasonCodeSchema.nullable(),
      occurredAt: pastInstantSchemaAt(now),
    })
    .refine(reasonFitsStage, REASON_STAGE_ISSUE);
  return z
    .array(eventSchema)
    .min(1, { abort: true })
    .max(IMPORT_LIMITS.historyMax)
    .refine((history) => history[0]?.toStage === 'applied', {
      error: 'The history starts with applied',
      path: [0, 'toStage'],
    })
    .superRefine(refuseEarlierEvents);
}

const importedFieldsSchema = applicationFieldsSchema
  .pick({
    company: true,
    position: true,
    url: true,
    salaryMin: true,
    salaryMax: true,
    currency: true,
  })
  .partial({ url: true, salaryMin: true, salaryMax: true, currency: true });

export function importRowSchemaAt(now: Date) {
  return importedFieldsSchema
    .extend({
      source: sourceSchema.default('other'),
      appliedAt: pastInstantSchemaAt(now),
      stage: stageSchema.default('applied'),
      stageHistory: stageHistorySchemaAt(now).optional(),
    })
    .refine(salaryRangeIsOrdered, SALARY_ORDER_ISSUE);
}

export const importApplicationsInputSchema = z.object({
  rows: z.array(z.unknown()).min(1).max(IMPORT_LIMITS.rowsMax),
});

export const importRowErrorSchema = z.object({
  row: z.int().nonnegative(),
  path: z.string(),
  message: z.string(),
});

export const importApplicationsResponseSchema = z.object({
  imported: z.int().nonnegative(),
  errors: z.array(importRowErrorSchema),
});

export type ImportRowInput = z.input<ReturnType<typeof importRowSchemaAt>>;
export type ImportRow = z.output<ReturnType<typeof importRowSchemaAt>>;
export type ImportedStageEvent = NonNullable<ImportRow['stageHistory']>[number];
export type ImportApplicationsInput = z.infer<typeof importApplicationsInputSchema>;
export type ImportRowError = z.infer<typeof importRowErrorSchema>;
export type ImportApplicationsResponse = z.infer<typeof importApplicationsResponseSchema>;
