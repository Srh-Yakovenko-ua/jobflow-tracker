import type {
  Application,
  ApplicationBoardQuery,
  ApplicationFilters,
  ApplicationListQuery,
  JobStatus,
  Stage,
} from '@jobflow/shared';

import type { ApplicationAiSegment } from '../api/application-ai';

export const applicationKeys = {
  all: ['applications'] as const,
  lists: () => [...applicationKeys.all, 'list'] as const,
  list: (query: ApplicationListQuery) => [...applicationKeys.lists(), query] as const,
  tables: () => [...applicationKeys.lists(), 'table'] as const,
  table: (filters: ApplicationFilters) => [...applicationKeys.tables(), filters] as const,
  boards: () => [...applicationKeys.all, 'board'] as const,
  board: (query: ApplicationBoardQuery) => [...applicationKeys.boards(), query] as const,
  details: () => [...applicationKeys.all, 'detail'] as const,
  detail: (id: Application['id']) => [...applicationKeys.details(), id] as const,
  ai: <Segment extends ApplicationAiSegment>(id: Application['id'], segment: Segment) =>
    [...applicationKeys.detail(id), segment] as const,
  reasonsSummaries: () => [...applicationKeys.all, 'reasons-summary'] as const,
  reasonsSummary: (stage: Stage) => [...applicationKeys.reasonsSummaries(), stage] as const,
};

export const jobKeys = {
  all: ['jobs'] as const,
  detail: (id: JobStatus['id'] | null) => [...jobKeys.all, id] as const,
};

export const timelineKeys = {
  all: ['timeline'] as const,
  detail: (applicationId: Application['id']) => [...timelineKeys.all, applicationId] as const,
};
