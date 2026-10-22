import {
  type ApplicationResponse,
  applicationSchema,
  type CreateApplicationInput,
  DEFAULT_SILENCE_DAYS,
  silenceLevelOf,
  type Stage,
  wholeDaysBetween,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { conflict, notFound } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { APPLICATION_EVENTS } from './applications.events.js';
import {
  type ApplicationChanges,
  type ApplicationRow,
  ApplicationsRepository,
} from './applications.repository.js';

export type ApplicationUpdate = { id: string; input: ApplicationChanges };

type RecordedChange = {
  count: number;
  id: string;
  fields: string[];
  tx: Prisma.TransactionClient;
};

const FIRST_STAGE = 'applied' satisfies Stage;

const APPLICATION_NOT_FOUND = 'Application not found';

function owned(row: ApplicationRow | null): ApplicationRow {
  if (row === null) {
    throw notFound(APPLICATION_NOT_FOUND);
  }
  return row;
}

function toApplicationResponse(row: ApplicationRow, now: Date): ApplicationResponse {
  const { stageEvents, user, aiParsed, appliedAt, lastEventAt, createdAt, updatedAt, ...columns } =
    row;
  const daysSinceLastEvent = wholeDaysBetween(lastEventAt, now);
  const silenceDays = user.settings?.silenceDays ?? DEFAULT_SILENCE_DAYS;
  return {
    ...columns,
    aiParsed: applicationSchema.shape.aiParsed.parse(aiParsed),
    appliedAt: appliedAt?.toISOString() ?? null,
    lastEventAt: lastEventAt.toISOString(),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    daysInStage: wholeDaysBetween(stageEvents[0]?.occurredAt ?? createdAt, now),
    daysSinceLastEvent,
    silenceLevel: silenceLevelOf({ stage: columns.currentStage, silenceDays, daysSinceLastEvent }),
  };
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly repository: ApplicationsRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async create(userId: string, input: CreateApplicationInput): Promise<ApplicationResponse> {
    const now = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      const { searchId, resumeVersionId } = await this.repository.findCreateDefaults(userId, {
        tx,
      });
      if (searchId === null) {
        throw conflict('No active search');
      }
      const created = await this.repository.insert(userId, {
        application: {
          ...input,
          searchId,
          resumeVersionId,
          currentStage: FIRST_STAGE,
          appliedAt: now,
          lastEventAt: now,
        },
        firstEvent: { fromStage: null, toStage: FIRST_STAGE, occurredAt: now },
        tx,
      });
      const event = { eventType: APPLICATION_EVENTS.created, applicationId: created.id };
      await this.repository.recordEvent(userId, { event, tx });
      return created;
    });
    return toApplicationResponse(row, now);
  }

  async get(userId: string, id: string): Promise<ApplicationResponse> {
    const row = owned(await this.repository.findOwned(userId, { id }));
    return toApplicationResponse(row, this.clock.now());
  }

  async update(userId: string, { id, input }: ApplicationUpdate): Promise<ApplicationResponse> {
    const row = await this.prisma.$transaction(async (tx) => {
      const count = await this.repository.updateOwned(userId, { id, data: input, tx });
      await this.recordChange(userId, { count, id, fields: Object.keys(input), tx });
      return owned(await this.repository.findOwned(userId, { id, tx }));
    });
    return toApplicationResponse(row, this.clock.now());
  }

  async remove(userId: string, id: string): Promise<void> {
    const deletedAt = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      const count = await this.repository.softDelete(userId, { id, deletedAt, tx });
      await this.recordChange(userId, { count, id, fields: ['deletedAt'], tx });
    });
  }

  private async recordChange(
    userId: string,
    { count, id, fields, tx }: RecordedChange,
  ): Promise<void> {
    if (count === 0) {
      throw notFound(APPLICATION_NOT_FOUND);
    }
    const event = { eventType: APPLICATION_EVENTS.updated, applicationId: id, fields };
    await this.repository.recordEvent(userId, { event, tx });
  }
}
