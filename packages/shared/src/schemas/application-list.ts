import { z } from 'zod';

import { aiJobStatusSchema } from '../ai-statuses.js';
import { scheduledEventKindSchema } from '../scheduled-events.js';
import { silenceLevelSchema } from '../silence.js';
import { sourceSchema } from '../sources.js';
import { outcomeStageSchema, stageSchema } from '../stages.js';
import { applicationResponseSchema } from './application.js';
import { paginatedSchema, paginationQuerySchema } from './pagination.js';
import { plainTextSchema } from './text.js';

export const APPLICATION_SORTS = ['-lastEventAt', 'lastEventAt'] as const;

export const APPLICATION_CARD_STACK_LIMIT = 3;

export function csvListOf<Item extends z.ZodType<unknown, string>>(item: Item) {
  return z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    )
    .pipe(z.array(item).min(1));
}

export const applicationFiltersSchema = z.object({
  stage: csvListOf(stageSchema).optional(),
  source: csvListOf(sourceSchema).optional(),
  q: plainTextSchema(200).optional(),
  hasScore: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  silence: csvListOf(silenceLevelSchema).optional(),
});

export const applicationListQuerySchema = applicationFiltersSchema.extend({
  ...paginationQuerySchema.shape,
  sort: z.enum(APPLICATION_SORTS).default('-lastEventAt'),
  searchId: z.uuid().optional(),
});

export const applicationBoardQuerySchema = applicationFiltersSchema
  .omit({ stage: true })
  .extend({ expand: csvListOf(outcomeStageSchema).optional() });

export const applicationCardSchema = applicationResponseSchema
  .pick({
    id: true,
    company: true,
    position: true,
    source: true,
    salaryMin: true,
    salaryMax: true,
    currency: true,
    matchScore: true,
    currentStage: true,
    isDraft: true,
    lastEventAt: true,
    daysInStage: true,
    daysSinceLastEvent: true,
    silenceLevel: true,
  })
  .extend({
    stack: z.array(z.string()).max(APPLICATION_CARD_STACK_LIMIT),
    stackCount: z.int32().min(0),
    nextScheduledEvent: z
      .object({ kind: scheduledEventKindSchema, startsAt: z.iso.datetime() })
      .nullable(),
    aiStatus: aiJobStatusSchema.nullable(),
  });

export const applicationListResponseSchema = paginatedSchema(applicationCardSchema);

export const boardColumnSchema = z.object({
  count: z.int32().min(0),
  items: z.array(applicationCardSchema).nullable(),
});

export const applicationBoardResponseSchema = z.object({
  columns: z.record(stageSchema, boardColumnSchema),
});

export type ApplicationFilters = z.infer<typeof applicationFiltersSchema>;
export type ApplicationListQuery = z.infer<typeof applicationListQuerySchema>;
export type ApplicationBoardQuery = z.infer<typeof applicationBoardQuerySchema>;
export type ApplicationCard = z.infer<typeof applicationCardSchema>;
export type ApplicationListResponse = z.infer<typeof applicationListResponseSchema>;
export type ApplicationBoardResponse = z.infer<typeof applicationBoardResponseSchema>;
