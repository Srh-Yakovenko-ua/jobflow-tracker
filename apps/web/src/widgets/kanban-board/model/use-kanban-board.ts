import { type ApplicationBoardQuery, OUTCOME_STAGES, type OutcomeStage } from '@jobflow/shared';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { type ApplicationCardContext, boardQueryOptions } from '@/entities/application';
import { meQueryOptions } from '@/entities/user';

export type BoardLoad = Readonly<{ failed: boolean; onRetry: () => void }>;

type Outcomes = { expanded: OutcomeStage[]; settled: OutcomeStage[] };

function boardQueryOf(expanded: readonly OutcomeStage[]): ApplicationBoardQuery {
  return expanded.length === 0 ? {} : { expand: [...expanded] };
}

function toggled(expanded: readonly OutcomeStage[], stage: OutcomeStage): OutcomeStage[] {
  const open = expanded.includes(stage)
    ? expanded.filter((outcome) => outcome !== stage)
    : [...expanded, stage];
  return OUTCOME_STAGES.filter((outcome) => open.includes(outcome));
}

function useUserTimeZone(): string {
  const { data } = useQuery({ ...meQueryOptions(), select: (me) => me.settings.timezone });
  return data ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function useKanbanBoard() {
  const queryClient = useQueryClient();
  const [outcomes, setOutcomes] = useState<Outcomes>({ expanded: [], settled: [] });
  const [mountedAt] = useState(Date.now);
  const board = useQuery({
    ...boardQueryOptions(boardQueryOf(outcomes.expanded)),
    placeholderData: keepPreviousData,
  });
  const settledKey = boardQueryOptions(boardQueryOf(outcomes.settled)).queryKey;
  const timeZone = useUserTimeZone();
  const context: ApplicationCardContext = {
    now: new Date(Math.max(board.dataUpdatedAt, mountedAt)),
    timeZone,
  };
  const onToggle = (stage: OutcomeStage) => {
    const arrived = board.data !== undefined && !board.isPlaceholderData;
    setOutcomes({
      expanded: toggled(outcomes.expanded, stage),
      settled: arrived ? outcomes.expanded : outcomes.settled,
    });
  };
  const load: BoardLoad = {
    failed: board.isError && !board.isFetching,
    onRetry: () => {
      void board.refetch();
    },
  };
  const data = board.data ?? queryClient.getQueryData(settledKey);
  return { data, context, expanded: outcomes.expanded, onToggle, load };
}
