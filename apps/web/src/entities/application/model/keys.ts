import type { Application, ApplicationBoardQuery, ApplicationListQuery } from '@jobflow/shared';

export const applicationKeys = {
  all: ['applications'] as const,
  lists: () => [...applicationKeys.all, 'list'] as const,
  list: (query: ApplicationListQuery) => [...applicationKeys.lists(), query] as const,
  boards: () => [...applicationKeys.all, 'board'] as const,
  board: (query: ApplicationBoardQuery) => [...applicationKeys.boards(), query] as const,
  detail: (id: Application['id']) => [...applicationKeys.all, 'detail', id] as const,
};

export const timelineKeys = {
  all: ['timeline'] as const,
  detail: (applicationId: Application['id']) => [...timelineKeys.all, applicationId] as const,
};
