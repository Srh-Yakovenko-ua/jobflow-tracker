import type {
  CreateScheduledEventInput,
  ScheduledEventStatus,
  Stage,
  UpdateScheduledEventInput,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { withoutUndefined } from '../../common/without-undefined.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ownedChildWhere } from '../../prisma/owned-child-where.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DateRange } from '../reminders/index.js';

export const SCHEDULED_EVENT_SELECT = {
  id: true,
  applicationId: true,
  kind: true,
  startsAt: true,
  durationMin: true,
  locationOrLink: true,
  status: true,
  outcomeNote: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ScheduledEventSelect;

const OWNED_EVENT_SELECT = {
  ...SCHEDULED_EVENT_SELECT,
  application: { select: { company: true, currentStage: true } },
} satisfies Prisma.ScheduledEventSelect;

const APPLICATION_EVENTS_SELECT = {
  scheduledEvents: {
    select: SCHEDULED_EVENT_SELECT,
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.ApplicationSelect;

const DEFAULT_TIME_ZONE = 'Europe/Kyiv';

export type ScheduledEventRow = Prisma.ScheduledEventGetPayload<{
  select: typeof SCHEDULED_EVENT_SELECT;
}>;

export type OwnedScheduledEventRow = Prisma.ScheduledEventGetPayload<{
  select: typeof OWNED_EVENT_SELECT;
}>;

export type ApplicationScheduledEvents = Prisma.ApplicationGetPayload<{
  select: typeof APPLICATION_EVENTS_SELECT;
}>;

export type CalendarEventRow = Omit<
  ScheduledEventRow,
  'outcomeNote' | 'createdAt' | 'updatedAt'
> & {
  company: string;
  currentStage: Stage;
};

type InTransaction = { tx?: Prisma.TransactionClient };

export type ScheduledEventsOfApplication = { applicationId: string };

export type ScheduledEventOfApplication = ScheduledEventsOfApplication & { eventId: string };

export type InsertScheduledEvent = ScheduledEventsOfApplication &
  InTransaction & { input: CreateScheduledEventInput; now: Date };

export type FindScheduledEvent = ScheduledEventOfApplication & InTransaction;

export type UpdateScheduledEvent = FindScheduledEvent & {
  input: UpdateScheduledEventInput;
  expectedStatus: ScheduledEventStatus;
  updatedAt: Date;
};

export function scheduledEventPatch({ startsAt, ...fields }: UpdateScheduledEventInput) {
  return {
    ...withoutUndefined(fields),
    ...(startsAt === undefined ? {} : { startsAt: new Date(startsAt) }),
  };
}

@Injectable()
export class ScheduledEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(
    userId: string,
    { applicationId, input, now, tx = this.prisma }: InsertScheduledEvent,
  ): Promise<ScheduledEventRow | null> {
    const application = await tx.application.findFirst({
      where: { id: applicationId, userId, deletedAt: null },
      select: { id: true },
    });
    if (application === null) {
      return null;
    }
    const { startsAt, ...fields } = input;
    return tx.scheduledEvent.create({
      data: {
        ...withoutUndefined(fields),
        applicationId,
        startsAt: new Date(startsAt),
        createdAt: now,
        updatedAt: now,
      },
      select: SCHEDULED_EVENT_SELECT,
    });
  }

  findForApplication(
    userId: string,
    { applicationId }: ScheduledEventsOfApplication,
  ): Promise<ApplicationScheduledEvents | null> {
    return this.prisma.application.findFirst({
      where: { id: applicationId, userId, deletedAt: null },
      select: APPLICATION_EVENTS_SELECT,
    });
  }

  findOwned(
    userId: string,
    { tx = this.prisma, applicationId, eventId }: FindScheduledEvent,
  ): Promise<OwnedScheduledEventRow | null> {
    return tx.scheduledEvent.findFirst({
      where: ownedChildWhere(userId, { applicationId, id: eventId }),
      select: OWNED_EVENT_SELECT,
    });
  }

  async updateOwned(userId: string, update: UpdateScheduledEvent): Promise<number> {
    const { input, expectedStatus, updatedAt, tx = this.prisma, applicationId, eventId } = update;
    const { count } = await tx.scheduledEvent.updateMany({
      where: { ...ownedChildWhere(userId, { applicationId, id: eventId }), status: expectedStatus },
      data: { ...scheduledEventPatch(input), updatedAt },
    });
    return count;
  }

  async deleteOwned(
    userId: string,
    { applicationId, eventId }: ScheduledEventOfApplication,
  ): Promise<number> {
    const { count } = await this.prisma.scheduledEvent.deleteMany({
      where: ownedChildWhere(userId, { applicationId, id: eventId }),
    });
    return count;
  }

  findCalendarEvents(userId: string, { from, to }: DateRange): Promise<CalendarEventRow[]> {
    return this.prisma.$queryRaw<CalendarEventRow[]>`
      SELECT e.id, e.application_id AS "applicationId", e.kind, e.starts_at AS "startsAt",
        e.duration_min AS "durationMin", e.location_or_link AS "locationOrLink", e.status,
        a.company, a.current_stage AS "currentStage"
      FROM scheduled_events e
      JOIN applications a ON a.id = e.application_id
      WHERE a.user_id = ${userId}::uuid AND a.deleted_at IS NULL
        AND e.status IN ('planned', 'done')
        AND e.starts_at < ${to.toISOString()}::timestamptz
        AND e.starts_at + make_interval(mins => e.duration_min) > ${from.toISOString()}::timestamptz
      ORDER BY e.starts_at, e.id`;
  }

  async findTimeZone(userId: string): Promise<string> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return settings?.timezone ?? DEFAULT_TIME_ZONE;
  }
}
