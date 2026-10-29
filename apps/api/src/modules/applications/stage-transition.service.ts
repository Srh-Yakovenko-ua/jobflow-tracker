import type { ApplicationResponse, MoveApplicationInput } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { Clock } from '../../common/clock.js';
import { owned } from '../../common/owned.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toApplicationResponse } from './application-response.js';
import { APPLICATION_EVENTS, type ApplicationEvent } from './applications.events.js';
import { ApplicationsRepository } from './applications.repository.js';
import {
  type StageEventPlan,
  type StageState,
  StageTransitionRepository,
} from './stage-transition.repository.js';
import { plannedMove, plannedUndo, type UndoContext } from './stage-transition-rules.js';

export type StageMove = { id: string; input: MoveApplicationInput };

type StageTransition = { id: string; plan: (context: UndoContext) => StageEventPlan };

type LockedApplication = { id: string; tx: Prisma.TransactionClient };

type AppliedStageEvent = Pick<StageEventPlan, 'event'> & { id: string };

function stageChanged({ id, event }: AppliedStageEvent): ApplicationEvent {
  const { fromStage, toStage, reasonCode, compensatesEventId } = event;
  return {
    eventType: APPLICATION_EVENTS.stageChanged,
    applicationId: id,
    fromStage,
    toStage,
    reasonCode,
    compensatesEventId,
  };
}

@Injectable()
export class StageTransitionService {
  constructor(
    private readonly transitions: StageTransitionRepository,
    private readonly applications: ApplicationsRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  move(userId: string, { id, input }: StageMove): Promise<ApplicationResponse> {
    return this.transition(userId, { id, plan: (context) => plannedMove({ ...context, input }) });
  }

  undoLast(userId: string, id: string): Promise<ApplicationResponse> {
    return this.transition(userId, { id, plan: plannedUndo });
  }

  private async transition(
    userId: string,
    { id, plan }: StageTransition,
  ): Promise<ApplicationResponse> {
    const now = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      const state = await this.lockedState(userId, { id, tx });
      const { event, lastEventAt } = plan({ state, now });
      const moved = await this.transitions.applyStageEvent(userId, { id, event, lastEventAt, tx });
      await this.applications.recordEvent(userId, { event: stageChanged({ id, event }), tx });
      return moved;
    });
    return toApplicationResponse(row, now);
  }

  private async lockedState(userId: string, { id, tx }: LockedApplication): Promise<StageState> {
    const locked = await this.transitions.lockOwned(userId, { id, tx });
    return owned(locked ? await this.transitions.findStageState(userId, { id, tx }) : null);
  }
}
