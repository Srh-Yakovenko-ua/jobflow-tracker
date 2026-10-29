import {
  canTransition,
  type MoveApplicationInput,
  type RejectionReasonCode,
  type Stage,
  STAGE_MOVE_LIMITS,
  type TransitionRefusalReason,
} from '@jobflow/shared';

import { conflict, illegalTransition, validation } from '../../common/app-error.js';
import type { StageEventPlan, StageState } from './stage-transition.repository.js';

export type UndoContext = { state: StageState; now: Date };

export type MoveContext = UndoContext & { input: MoveApplicationInput };

type Transition = { from: Stage; to: Stage; stageBeforeGhosted: Stage | null | undefined };

function refusalOf({ from, to, stageBeforeGhosted }: Transition): TransitionRefusalReason | null {
  const result = canTransition(from, to);
  if (!result.ok) {
    return result.reason;
  }
  return from === 'ghosted' && to !== stageBeforeGhosted ? 'not_allowed' : null;
}

function refuseIllegalTransition(transition: Transition): void {
  const reason = refusalOf(transition);
  if (reason !== null) {
    throw illegalTransition(`${transition.from} -> ${transition.to}: ${reason}`);
  }
}

function occurredAtOf({ state, input, now }: MoveContext): Date {
  const occurredAt = input.occurredAt === undefined ? now : new Date(input.occurredAt);
  if (occurredAt > now) {
    throw validation([{ path: 'occurredAt', message: 'occurredAt must not be in the future' }]);
  }
  const previous = state.stageEvents[0]?.occurredAt;
  if (previous !== undefined && occurredAt < previous) {
    const message = `occurredAt must not be before the previous event at ${previous.toISOString()}`;
    throw validation([{ path: 'occurredAt', message }]);
  }
  return occurredAt;
}

function reasonCodeOf({ state, input }: MoveContext): RejectionReasonCode | null {
  if (input.toStage !== 'rejected' || input.reasonCode !== undefined) {
    return input.reasonCode ?? null;
  }
  if (state.user.settings?.askRejectionReason !== false) {
    const message = 'A move to rejected needs a reason code; send unspecified to skip it';
    throw validation([{ path: 'reasonCode', message }]);
  }
  return 'unspecified';
}

export function plannedMove(context: MoveContext): StageEventPlan {
  const { state, input, now } = context;
  if (input.fromStage !== state.currentStage) {
    throw conflict(`The application is in ${state.currentStage}, not ${input.fromStage}`);
  }
  refuseIllegalTransition({
    from: state.currentStage,
    to: input.toStage,
    stageBeforeGhosted: state.stageEvents[0]?.fromStage,
  });
  const occurredAt = occurredAtOf(context);
  const event = {
    fromStage: state.currentStage,
    toStage: input.toStage,
    reasonCode: reasonCodeOf(context),
    comment: input.comment ?? null,
    occurredAt,
    compensatesEventId: null,
    createdAt: now,
  };
  return { event, lastEventAt: occurredAt };
}

export function plannedUndo({ state, now }: UndoContext): StageEventPlan {
  const [target, previous] = state.stageEvents;
  if (target === undefined || target.fromStage === null || previous === undefined) {
    throw conflict('Nothing to undo');
  }
  if (now.getTime() - target.createdAt.getTime() > STAGE_MOVE_LIMITS.undoWindowMs) {
    throw conflict('The undo window has passed');
  }
  const event = {
    fromStage: target.toStage,
    toStage: target.fromStage,
    reasonCode: null,
    comment: null,
    occurredAt: now,
    compensatesEventId: target.id,
    createdAt: now,
  };
  return { event, lastEventAt: previous.occurredAt };
}
