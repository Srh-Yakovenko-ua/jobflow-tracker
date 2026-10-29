import type { Note, NoteInput, NoteListResponse } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { notFound } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { owned } from '../../common/owned.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TimelineService } from '../events/index.js';
import {
  type NoteOfApplication,
  type NoteRow,
  type NotesOfApplication,
  NotesRepository,
} from './notes.repository.js';

const NOTE_NOT_FOUND = 'Note not found';

export type CreateNote = NotesOfApplication & { input: NoteInput };

export type EditNote = NoteOfApplication & { input: NoteInput };

function toNote({ createdAt, updatedAt, ...row }: NoteRow): Note {
  return { ...row, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() };
}

function noteChanged(count: number): void {
  if (count === 0) {
    throw notFound(NOTE_NOT_FOUND);
  }
}

@Injectable()
export class NotesService {
  constructor(
    private readonly repository: NotesRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly timeline: TimelineService,
  ) {}

  async create(userId: string, { applicationId, input }: CreateNote): Promise<Note> {
    const now = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      const note = owned(
        await this.repository.insert(userId, { applicationId, body: input.body, now, tx }),
      );
      await this.timeline.record(userId, {
        applicationId,
        kind: 'note_added',
        payload: { noteId: note.id },
        occurredAt: now,
        tx,
      });
      return note;
    });
    return toNote(row);
  }

  async list(userId: string, applicationId: string): Promise<NoteListResponse> {
    const { notes } = owned(await this.repository.findForApplication(userId, { applicationId }));
    return { items: notes.map(toNote) };
  }

  async update(userId: string, { input, ...note }: EditNote): Promise<Note> {
    const updatedAt = this.clock.now();
    const row = await this.prisma.$transaction(async (tx) => {
      noteChanged(
        await this.repository.updateOwned(userId, { ...note, body: input.body, updatedAt, tx }),
      );
      return owned(await this.repository.findOwned(userId, { ...note, tx }), NOTE_NOT_FOUND);
    });
    return toNote(row);
  }

  async remove(userId: string, note: NoteOfApplication): Promise<void> {
    noteChanged(await this.repository.deleteOwned(userId, note));
  }
}
