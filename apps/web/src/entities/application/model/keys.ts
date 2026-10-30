import type {
  Application,
  ApplicationBoardQuery,
  ApplicationListQuery,
  Stage,
} from '@jobflow/shared';

export const applicationKeys = {
  all: ['applications'] as const,
  lists: () => [...applicationKeys.all, 'list'] as const,
  list: (query: ApplicationListQuery) => [...applicationKeys.lists(), query] as const,
  boards: () => [...applicationKeys.all, 'board'] as const,
  board: (query: ApplicationBoardQuery) => [...applicationKeys.boards(), query] as const,
  details: () => [...applicationKeys.all, 'detail'] as const,
  detail: (id: Application['id']) => [...applicationKeys.details(), id] as const,
  reasonsSummaries: () => [...applicationKeys.all, 'reasons-summary'] as const,
  reasonsSummary: (stage: Stage) => [...applicationKeys.reasonsSummaries(), stage] as const,
};

export const timelineKeys = {
  all: ['timeline'] as const,
  detail: (applicationId: Application['id']) => [...timelineKeys.all, applicationId] as const,
};
