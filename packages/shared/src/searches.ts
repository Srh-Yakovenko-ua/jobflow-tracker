import { z } from 'zod';

export const DEFAULT_SEARCH_TITLE = 'Мій пошук';

export const SEARCH_STATUSES = ['active', 'archived'] as const;

export const searchStatusSchema = z.enum(SEARCH_STATUSES);

export type SearchStatus = z.infer<typeof searchStatusSchema>;
