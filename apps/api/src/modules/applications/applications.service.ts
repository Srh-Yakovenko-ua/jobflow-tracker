import type {
  ApplicationResponse,
  CreateApplicationInput,
  CreateApplicationResponse,
  PossibleDuplicate,
  Stage,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { milliseconds, subMilliseconds } from 'date-fns';

import { conflict, notFound } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { APPLICATION_NOT_FOUND, owned } from '../../common/owned.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ApplicationDuplicatesRepository,
  DUPLICATE_LIMITS,
  type DuplicateProbe,
} from './application-duplicates.repository.js';
import { toApplicationResponse } from './application-response.js';
import { APPLICATION_EVENTS } from './applications.events.js';
import {
  type ApplicationChanges,
  type ApplicationFields,
  type ApplicationRow,
  ApplicationsRepository,
} from './applications.repository.js';

export type ApplicationUpdate = { id: string; input: ApplicationChanges };

export type InsertApplied = {
  fields: ApplicationFields;
  now: Date;
  tx: Prisma.TransactionClient;
};

type RecordedChange = {
  count: number;
  id: string;
  fields: string[];
  tx: Prisma.TransactionClient;
};

type DuplicateCheck = { probe: DuplicateProbe; now: Date };

const FIRST_STAGE = 'applied' satisfies Stage;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly repository: ApplicationsRepository,
    private readonly duplicates: ApplicationDuplicatesRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  possibleDuplicates(userId: string, probe: DuplicateProbe): Promise<PossibleDuplicate[]> {
    return this.duplicatesAt(userId, { probe, now: this.clock.now() });
  }

  async create(userId: string, input: CreateApplicationInput): Promise<CreateApplicationResponse> {
    const now = this.clock.now();
    const possibleDuplicates = await this.duplicatesAt(userId, { probe: input, now });
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await this.insertApplied(userId, { fields: input, now, tx });
      const event = { eventType: APPLICATION_EVENTS.created, applicationId: created.id };
      await this.repository.recordEvent(userId, { event, tx });
      return created;
    });
    return { ...toApplicationResponse(row, now), possibleDuplicates };
  }

  async insertApplied(userId: string, { fields, now, tx }: InsertApplied): Promise<ApplicationRow> {
    const { searchId, resumeVersionId } = await this.repository.findCreateDefaults(userId, { tx });
    if (searchId === null) {
      throw conflict('No active search');
    }
    return this.repository.insert(userId, {
      application: {
        ...fields,
        searchId,
        resumeVersionId,
        currentStage: FIRST_STAGE,
        appliedAt: now,
        lastEventAt: now,
      },
      firstEvent: { fromStage: null, toStage: FIRST_STAGE, occurredAt: now },
      tx,
    });
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

  private async duplicatesAt(
    userId: string,
    { probe, now }: DuplicateCheck,
  ): Promise<PossibleDuplicate[]> {
    const since = subMilliseconds(now, milliseconds({ days: DUPLICATE_LIMITS.windowDays }));
    const rows = await this.duplicates.findPossible(userId, { ...probe, since });
    return rows.map(({ appliedAt, ...duplicate }) => ({
      ...duplicate,
      appliedAt: appliedAt?.toISOString() ?? null,
    }));
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
