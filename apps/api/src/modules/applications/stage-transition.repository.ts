import type { RejectionReasonCode, Stage } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  APPLICATION_SELECT,
  type ApplicationById,
  type ApplicationRow,
  EFFECTIVE_STAGE_EVENTS,
} from './applications.repository.js';

const STAGE_STATE_SELECT = {
  currentStage: true,
  stageEvents: {
    ...EFFECTIVE_STAGE_EVENTS,
    take: 2,
    select: { id: true, fromStage: true, toStage: true, occurredAt: true, createdAt: true },
  },
  user: { select: { settings: { select: { askRejectionReason: true } } } },
} satisfies Prisma.ApplicationSelect;

export type StageState = Prisma.ApplicationGetPayload<{ select: typeof STAGE_STATE_SELECT }>;

export type EffectiveStageEvent = StageState['stageEvents'][number];

export type NewStageEvent = {
  fromStage: Stage;
  toStage: Stage;
  reasonCode: RejectionReasonCode | null;
  comment: string | null;
  occurredAt: Date;
  compensatesEventId: string | null;
  createdAt: Date;
};

export type StageEventPlan = { event: NewStageEvent; lastEventAt: Date };

export type ApplyStageEvent = ApplicationById & StageEventPlan;

@Injectable()
export class StageTransitionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async lockOwned(userId: string, { id, tx = this.prisma }: ApplicationById): Promise<boolean> {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM applications
      WHERE id = ${id}::uuid AND user_id = ${userId}::uuid AND deleted_at IS NULL
      FOR UPDATE`;
    return locked.length > 0;
  }

  findStageState(
    userId: string,
    { id, tx = this.prisma }: ApplicationById,
  ): Promise<StageState | null> {
    return tx.application.findFirst({
      where: { id, userId, deletedAt: null },
      select: STAGE_STATE_SELECT,
    });
  }

  applyStageEvent(
    userId: string,
    { id, event, lastEventAt, tx = this.prisma }: ApplyStageEvent,
  ): Promise<ApplicationRow> {
    return tx.application.update({
      where: { id, userId, deletedAt: null },
      data: { currentStage: event.toStage, lastEventAt, stageEvents: { create: event } },
      select: APPLICATION_SELECT,
    });
  }
}
