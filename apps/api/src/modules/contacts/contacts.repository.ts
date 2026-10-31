import type { CreateContactInput, TimelineEventKind, UpdateContactInput } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { withoutUndefined } from '../../common/without-undefined.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { EFFECTIVE_STAGE_EVENTS } from '../../prisma/effective-stage-events.js';
import { ownedChildWhere } from '../../prisma/owned-child-where.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export const CONTACT_SELECT = {
  id: true,
  applicationId: true,
  name: true,
  role: true,
  email: true,
  telegram: true,
  phone: true,
  note: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContactSelect;

const WAITING_TIMELINE_KINDS: TimelineEventKind[] = ['followup_sent', 'interview_done'];

const APPLICATION_HISTORY_SELECT = {
  id: true,
  contacts: { select: CONTACT_SELECT, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  stageEvents: {
    ...EFFECTIVE_STAGE_EVENTS,
    select: { fromStage: true, toStage: true, reasonCode: true, occurredAt: true },
  },
  timelineEvents: {
    where: { kind: { in: WAITING_TIMELINE_KINDS } },
    select: { occurredAt: true },
  },
} satisfies Prisma.ApplicationSelect;

export type ContactRow = Prisma.ContactGetPayload<{ select: typeof CONTACT_SELECT }>;

export type ApplicationHistory = Prisma.ApplicationGetPayload<{
  select: typeof APPLICATION_HISTORY_SELECT;
}>;

type InTransaction = { tx?: Prisma.TransactionClient };

export type ContactsOfApplication = { applicationId: string };

export type ContactOfApplication = ContactsOfApplication & { contactId: string };

export type InsertContact = ContactsOfApplication & { input: CreateContactInput; now: Date };

export type FindContact = ContactOfApplication & InTransaction;

export type UpdateContact = FindContact & { input: UpdateContactInput; updatedAt: Date };

export type HistoryOfApplications = { applicationIds: string[] };

@Injectable()
export class ContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(
    userId: string,
    { applicationId, input, now }: InsertContact,
  ): Promise<ContactRow | null> {
    const { name, role = null, email = null, telegram = null, phone = null, note = null } = input;
    const at = now.toISOString();
    const rows = await this.prisma.$queryRaw<ContactRow[]>`
      INSERT INTO contacts (application_id, name, role, email, telegram, phone, note, created_at, updated_at)
      SELECT id, ${name}::text, ${role}::text, ${email}::text, ${telegram}::text, ${phone}::text,
        ${note}::text, ${at}::timestamptz, ${at}::timestamptz
      FROM applications
      WHERE id = ${applicationId}::uuid AND user_id = ${userId}::uuid AND deleted_at IS NULL
      RETURNING id, application_id AS "applicationId", name, role, email, telegram, phone, note,
        created_at AS "createdAt", updated_at AS "updatedAt"`;
    return rows[0] ?? null;
  }

  async sameCompanyApplicationIds(
    userId: string,
    { applicationId }: ContactsOfApplication,
  ): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT b.id
      FROM applications a
      JOIN applications b ON b.user_id = a.user_id AND b.deleted_at IS NULL
        AND lower(b.company) = lower(a.company)
      WHERE a.id = ${applicationId}::uuid AND a.user_id = ${userId}::uuid AND a.deleted_at IS NULL`;
    return rows.map(({ id }) => id);
  }

  findHistory(
    userId: string,
    { applicationIds }: HistoryOfApplications,
  ): Promise<ApplicationHistory[]> {
    return this.prisma.application.findMany({
      where: { id: { in: applicationIds }, userId, deletedAt: null },
      select: APPLICATION_HISTORY_SELECT,
    });
  }

  async updateOwned(
    userId: string,
    { input, updatedAt, tx = this.prisma, applicationId, contactId }: UpdateContact,
  ): Promise<number> {
    const { count } = await tx.contact.updateMany({
      where: ownedChildWhere(userId, { applicationId, id: contactId }),
      data: { ...withoutUndefined(input), updatedAt },
    });
    return count;
  }

  findOwned(
    userId: string,
    { tx = this.prisma, applicationId, contactId }: FindContact,
  ): Promise<ContactRow | null> {
    return tx.contact.findFirst({
      where: ownedChildWhere(userId, { applicationId, id: contactId }),
      select: CONTACT_SELECT,
    });
  }

  async deleteOwned(
    userId: string,
    { applicationId, contactId }: ContactOfApplication,
  ): Promise<number> {
    const { count } = await this.prisma.contact.deleteMany({
      where: ownedChildWhere(userId, { applicationId, id: contactId }),
    });
    return count;
  }
}
