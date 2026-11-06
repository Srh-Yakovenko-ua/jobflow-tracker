import { type ApplicationCard, canTransition, type Stage } from '@jobflow/shared';
import { type MutateOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { showToast } from '@/shared/ui/toast';

import { moveApplication } from '../api/move-application';
import { type BulkMoveResult, bulkMoveToastOf } from '../lib/bulk-move-toast';
import { nextStageOf } from '../lib/next-stage';
import { invalidateAfterMove } from './invalidate-after-move';

export type BulkMoveTarget = 'next' | 'withdrawn';

export type BulkMoveInput = Readonly<{
  applications: readonly ApplicationCard[];
  target: BulkMoveTarget;
}>;

type PlannedMove = Readonly<{ application: ApplicationCard; toStage: Stage }>;

const TARGET_STAGE_OF: Record<BulkMoveTarget, (stage: Stage) => Stage | null> = {
  next: nextStageOf,
  withdrawn: (stage) => (canTransition(stage, 'withdrawn').ok ? 'withdrawn' : null),
};

function planOf({ applications, target }: BulkMoveInput): PlannedMove[] {
  return applications.flatMap((application) => {
    const toStage = TARGET_STAGE_OF[target](application.currentStage);
    return toStage === null ? [] : [{ application, toStage }];
  });
}

async function movedOrNot({ application, toStage }: PlannedMove): Promise<boolean> {
  const body = { fromStage: application.currentStage, toStage };
  try {
    await moveApplication({ applicationId: application.id, body });
    return true;
  } catch {
    return false;
  }
}

async function moveInTurn(input: BulkMoveInput): Promise<BulkMoveResult> {
  const plan = planOf(input);
  let moved = 0;
  for (const move of plan) {
    moved += (await movedOrNot(move)) ? 1 : 0;
  }
  return {
    moved,
    failed: plan.length - moved,
    skipped: input.applications.length - plan.length,
  };
}

export function useBulkMoveMutation() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: moveInTurn,
    networkMode: 'always',
    onSuccess: (result) => {
      showToast(bulkMoveToastOf(result));
    },
    onSettled: () => invalidateAfterMove(queryClient),
  });
  const move = (
    input: BulkMoveInput,
    options?: MutateOptions<BulkMoveResult, Error, BulkMoveInput>,
  ) => {
    if (!mutation.isPending) {
      mutation.mutate(input, options);
    }
  };
  return { move, isPending: mutation.isPending };
}
