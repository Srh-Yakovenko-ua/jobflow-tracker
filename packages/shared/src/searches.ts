import { z } from 'zod';

export const DEFAULT_SEARCH_TITLE = 'Мій пошук';

export const SEARCH_STATUSES = ['active', 'archived'] as const;

export const searchStatusSchema = z.enum(SEARCH_STATUSES);

export const SEARCH_OUTCOMES = ['offer_accepted', 'paused', 'other'] as const;

export const searchOutcomeSchema = z.enum(SEARCH_OUTCOMES);

export const OPEN_APPLICATION_CHOICES = ['move', 'withdraw'] as const;

export const openApplicationChoiceSchema = z.enum(OPEN_APPLICATION_CHOICES);

export const finishSearchInputSchema = z.object({
  searchId: z.uuid(),
  outcome: searchOutcomeSchema,
  openApplications: openApplicationChoiceSchema,
});

const searchCountSchema = z.int32().min(0);

export const searchSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  status: searchStatusSchema,
  outcome: searchOutcomeSchema.nullable(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  days: searchCountSchema,
  applications: searchCountSchema,
  interviews: searchCountSchema,
  offers: searchCountSchema,
  daysToOffer: searchCountSchema.nullable(),
});

export const searchListResponseSchema = z.object({ items: z.array(searchSummarySchema) });

export const finishSearchResponseSchema = z.object({
  finished: searchSummarySchema,
  current: searchSummarySchema,
});

export type SearchStatus = z.infer<typeof searchStatusSchema>;
export type SearchOutcome = z.infer<typeof searchOutcomeSchema>;
export type OpenApplicationChoice = z.infer<typeof openApplicationChoiceSchema>;
export type FinishSearchInput = z.infer<typeof finishSearchInputSchema>;
export type SearchSummary = z.infer<typeof searchSummarySchema>;
export type SearchListResponse = z.infer<typeof searchListResponseSchema>;
export type FinishSearchResponse = z.infer<typeof finishSearchResponseSchema>;
