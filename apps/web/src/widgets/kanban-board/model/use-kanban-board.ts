import {
  type ApplicationBoardQuery,
  type ApplicationBoardResponse,
  type ApplicationFilters,
  LIVE_LIMITS,
  OUTCOME_STAGES,
  type OutcomeStage,
} from '@jobflow/shared';
import { hashKey, keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  type ApplicationCardContext,
  applicationKeys,
  boardQueryOptions,
  draftStateOf,
} from '@/entities/application';
import { useUserTimeZone } from '@/entities/user';
import { useSentFilters } from '@/features/filter-applications';
import { LIVE_CLIENT_LIMITS, useLiveConnected } from '@/shared/api';

export type BoardLoad = Readonly<{
  failed: boolean;
  filtersFailed: boolean;
  filtersPending: boolean;
  onRetry: () => void;
}>;

export type BoardSearchState = Readonly<{ filtered: boolean; q: string | undefined }>;

type BoardQueryInput = Readonly<{ expanded: readonly OutcomeStage[]; filters: ApplicationFilters }>;

type ArrivalInput = Readonly<{ query: ApplicationBoardQuery; arrived: boolean }>;

type SearchInput = Readonly<{ filters: ApplicationFilters; shown: ApplicationBoardQuery }>;

function boardQueryOf({ expanded, filters }: BoardQueryInput): ApplicationBoardQuery {
  return {
    source: filters.source,
    q: filters.q,
    hasScore: filters.hasScore,
    silence: filters.silence,
    salaryFrom: filters.salaryFrom,
    expand: expanded.length === 0 ? undefined : [...expanded],
  };
}

function hasParsingCard(board: ApplicationBoardResponse | undefined): boolean {
  return Object.values(board?.columns ?? {}).some(({ items }) =>
    (items ?? []).some((card) => draftStateOf(card) === 'parsing'),
  );
}

function useParsingPollMs(): number {
  return useLiveConnected() ? LIVE_CLIENT_LIMITS.slowPollMs : LIVE_LIMITS.pollFallbackMs;
}

function toggled(expanded: readonly OutcomeStage[], stage: OutcomeStage): OutcomeStage[] {
  const open = expanded.includes(stage)
    ? expanded.filter((outcome) => outcome !== stage)
    : [...expanded, stage];
  return OUTCOME_STAGES.filter((outcome) => open.includes(outcome));
}

function filtersHashOf(query: ApplicationBoardQuery): string {
  return hashKey(applicationKeys.board({ ...query, expand: undefined }));
}

function useLastArrived({ query, arrived }: ArrivalInput): ApplicationBoardQuery {
  const [shown, setShown] = useState(query);
  if (arrived && hashKey(applicationKeys.board(query)) !== hashKey(applicationKeys.board(shown))) {
    setShown(query);
  }
  return shown;
}

function searchOf({ filters, shown }: SearchInput): BoardSearchState {
  const sent = Object.values({ ...shown, expand: undefined }).some((value) => value !== undefined);
  return { filtered: filters.stage !== undefined || sent, q: shown.q };
}

export function useKanbanBoard() {
  const filters = useSentFilters();
  const [expanded, setExpanded] = useState<OutcomeStage[]>([]);
  const [mountedAt] = useState(Date.now);
  const query = boardQueryOf({ expanded, filters });
  const parsingPollMs = useParsingPollMs();
  const board = useQuery({
    ...boardQueryOptions(query),
    placeholderData: keepPreviousData,
    refetchInterval: ({ state }) => (hasParsingCard(state.data) ? parsingPollMs : false),
  });
  const arrived = board.data !== undefined && !board.isPlaceholderData;
  const shown = useLastArrived({ query, arrived });
  const fallback = useQuery({ ...boardQueryOptions(shown), enabled: false });
  const timeZone = useUserTimeZone();
  const context: ApplicationCardContext = {
    now: new Date(Math.max(board.dataUpdatedAt, mountedAt)),
    timeZone,
  };
  const failed = board.isError && !board.isFetching;
  const filtersChanged = filtersHashOf(query) !== filtersHashOf(shown);
  const load: BoardLoad = {
    failed,
    filtersFailed: failed && filtersChanged,
    filtersPending: board.isFetching && filtersChanged,
    onRetry: () => {
      void board.refetch();
    },
  };
  const onToggle = (stage: OutcomeStage) => {
    setExpanded(toggled(expanded, stage));
  };
  const data = board.data ?? fallback.data;
  const search = searchOf({ filters, shown });
  return { data, context, outcomes: { expanded, onToggle, load }, search };
}
