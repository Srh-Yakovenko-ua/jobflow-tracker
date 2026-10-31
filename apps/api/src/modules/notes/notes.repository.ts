import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { ownedChildWhere } from '../../prisma/owned-child-where.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export const NOTE_SELECT = {
  id: true,
  applicationId: true,
  body: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NoteSelect;

const APPLICATION_NOTES_SELECT = {
  notes: { select: NOTE_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
} satisfies Prisma.ApplicationSelect;

export type NoteRow = Prisma.NoteGetPayload<{ select: typeof NOTE_SELECT }>;

export type ApplicationNotes = Prisma.ApplicationGetPayload<{
  select: typeof APPLICATION_NOTES_SELECT;
}>;

type InTransaction = { tx?: Prisma.TransactionClient };

export type NotesOfApplication = { applicationId: string };

export type NoteOfApplication = NotesOfApplication & { noteId: string };

export type InsertNote = NotesOfApplication & InTransaction & { body: string; now: Date };

export type FindNote = NoteOfApplication & InTransaction;

export type UpdateNote = FindNote & { body: string; updatedAt: Date };

@Injectable()
export class NotesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(
    userId: string,
    { applicationId, body, now, tx = this.prisma }: InsertNote,
  ): Promise<NoteRow | null> {
    const at = now.toISOString();
    const rows = await tx.$queryRaw<NoteRow[]>`
      INSERT INTO notes (application_id, body, created_at, updated_at)
      SELECT id, ${body}::text, ${at}::timestamptz, ${at}::timestamptz
      FROM applications
      WHERE id = ${applicationId}::uuid AND user_id = ${userId}::uuid AND deleted_at IS NULL
      RETURNING id, application_id AS "applicationId", body, created_at AS "createdAt",
        updated_at AS "updatedAt"`;
    return rows[0] ?? null;
  }

  findForApplication(
    userId: string,
    { applicationId }: NotesOfApplication,
  ): Promise<ApplicationNotes | null> {
    return this.prisma.application.findFirst({
      where: { id: applicationId, userId, deletedAt: null },
      select: APPLICATION_NOTES_SELECT,
    });
  }

  async updateOwned(
    userId: string,
    { body, updatedAt, tx = this.prisma, applicationId, noteId }: UpdateNote,
  ): Promise<number> {
    const { count } = await tx.note.updateMany({
      where: ownedChildWhere(userId, { applicationId, id: noteId }),
      data: { body, updatedAt },
    });
    return count;
  }

  findOwned(
    userId: string,
    { tx = this.prisma, applicationId, noteId }: FindNote,
  ): Promise<NoteRow | null> {
    return tx.note.findFirst({
      where: ownedChildWhere(userId, { applicationId, id: noteId }),
      select: NOTE_SELECT,
    });
  }

  async deleteOwned(userId: string, { applicationId, noteId }: NoteOfApplication): Promise<number> {
    const { count } = await this.prisma.note.deleteMany({
      where: ownedChildWhere(userId, { applicationId, id: noteId }),
    });
    return count;
  }
}
