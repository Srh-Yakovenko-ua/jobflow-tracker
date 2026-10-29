import type { NoteInput } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { FAKE_TRANSACTION, fakeTransactionModule } from '../../test/fake-prisma.js';
import { type ByUser, RecordedEvents } from '../../test/recorded-events.js';
import {
  APPLICATION_ID,
  APPLICATION_NOT_FOUND,
  MISSING_ID,
  MISSING_TARGETS,
  NOTE_ID,
  OLENA_ID,
  type Target,
} from '../../test/service-fixtures.js';
import { daysBefore, NOW } from '../../test/time.js';
import { type TimelineEntry, TimelineService } from '../events/index.js';
import {
  type ApplicationNotes,
  type FindNote,
  type InsertNote,
  type NoteOfApplication,
  type NoteRow,
  type NotesOfApplication,
  NotesRepository,
  type UpdateNote,
} from './notes.repository.js';
import { NotesService } from './notes.service.js';

const NOW_ISO = '2026-10-22T09:00:00.000Z';

const INPUT: NoteInput = { body: '## Техінтерв’ю\n\n  - повторити DP\n<script>x</script>' };

const NOTE_NOT_FOUND = {
  body: { status: 404, type: 'not_found', detail: 'Note not found' },
};

const STORED_NOTE: NoteRow = {
  id: NOTE_ID,
  applicationId: APPLICATION_ID,
  body: 'Спитати про on-call',
  createdAt: daysBefore(1),
  updatedAt: daysBefore(1),
};

const MISSING_NOTE: NoteOfApplication = { applicationId: APPLICATION_ID, noteId: MISSING_ID };

class FakeNotesRepository {
  readonly inserted: ByUser<InsertNote>[] = [];
  readonly updates: ByUser<UpdateNote>[] = [];
  private stored = STORED_NOTE;

  insert(userId: string, input: InsertNote): Promise<NoteRow | null> {
    if (!this.ownsApplication({ userId, id: input.applicationId })) {
      return Promise.resolve(null);
    }
    this.inserted.push({ userId, ...input });
    const { applicationId, body, now } = input;
    return Promise.resolve({ id: NOTE_ID, applicationId, body, createdAt: now, updatedAt: now });
  }

  findForApplication(
    userId: string,
    { applicationId }: NotesOfApplication,
  ): Promise<ApplicationNotes | null> {
    const owns = this.ownsApplication({ userId, id: applicationId });
    return Promise.resolve(owns ? { notes: [this.stored] } : null);
  }

  updateOwned(userId: string, input: UpdateNote): Promise<number> {
    if (!this.ownsNote(userId, input)) {
      return Promise.resolve(0);
    }
    this.updates.push({ userId, ...input });
    this.stored = { ...this.stored, body: input.body, updatedAt: input.updatedAt };
    return Promise.resolve(1);
  }

  findOwned(userId: string, note: FindNote): Promise<NoteRow | null> {
    return Promise.resolve(this.ownsNote(userId, note) ? this.stored : null);
  }

  deleteOwned(userId: string, note: NoteOfApplication): Promise<number> {
    return Promise.resolve(this.ownsNote(userId, note) ? 1 : 0);
  }

  private ownsApplication({ userId, id }: Target): boolean {
    return userId === OLENA_ID && id === APPLICATION_ID;
  }

  private ownsNote(userId: string, { applicationId, noteId }: NoteOfApplication): boolean {
    return this.ownsApplication({ userId, id: applicationId }) && noteId === this.stored.id;
  }
}

class TimelineRecorder extends RecordedEvents<TimelineEntry> {
  record(userId: string, entry: TimelineEntry): Promise<void> {
    return this.recordEvent(userId, entry);
  }
}

async function serviceWithFakes() {
  const repository = new FakeNotesRepository();
  const timeline = new TimelineRecorder();
  const moduleRef = await fakeTransactionModule({
    providers: [NotesService, NotesRepository, TimelineService],
    now: NOW,
  })
    .overrideProvider(NotesRepository)
    .useValue(repository)
    .overrideProvider(TimelineService)
    .useValue(timeline)
    .compile();
  return { repository, timeline, service: moduleRef.get(NotesService) };
}

const APPLICATION_CALLS = [
  {
    method: 'create',
    call: (service: NotesService, { userId, id }: Target) =>
      service.create(userId, { applicationId: id, input: INPUT }),
  },
  {
    method: 'list',
    call: (service: NotesService, { userId, id }: Target) => service.list(userId, id),
  },
];

describe('NotesService.create', () => {
  it('returns the note stamped with the clock time and records one note_added in the insert transaction', async () => {
    const { repository, timeline, service } = await serviceWithFakes();

    const note = await service.create(OLENA_ID, { applicationId: APPLICATION_ID, input: INPUT });

    expect(note).toEqual({
      id: NOTE_ID,
      applicationId: APPLICATION_ID,
      body: INPUT.body,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    });
    expect(repository.inserted).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        body: INPUT.body,
        now: NOW,
        tx: FAKE_TRANSACTION,
      },
    ]);
    expect(timeline.events).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        kind: 'note_added',
        payload: { noteId: NOTE_ID },
        occurredAt: NOW,
        tx: FAKE_TRANSACTION,
      },
    ]);
  });
});

describe.each(APPLICATION_CALLS)('NotesService.$method', ({ call }) => {
  it.each(MISSING_TARGETS)('answers $case with 404 and records nothing', async (target) => {
    const { repository, timeline, service } = await serviceWithFakes();

    await expect(call(service, target)).rejects.toMatchObject(APPLICATION_NOT_FOUND);
    expect([repository.inserted, timeline.events]).toEqual([[], []]);
  });
});

describe('NotesService.update', () => {
  it('writes the new body at the clock time, keeps createdAt and records no timeline entry', async () => {
    const { repository, timeline, service } = await serviceWithFakes();

    const note = await service.update(OLENA_ID, {
      applicationId: APPLICATION_ID,
      noteId: NOTE_ID,
      input: INPUT,
    });

    expect(repository.updates).toEqual([
      {
        userId: OLENA_ID,
        applicationId: APPLICATION_ID,
        noteId: NOTE_ID,
        body: INPUT.body,
        updatedAt: NOW,
        tx: FAKE_TRANSACTION,
      },
    ]);
    expect(note).toEqual({
      id: NOTE_ID,
      applicationId: APPLICATION_ID,
      body: INPUT.body,
      createdAt: '2026-10-21T09:00:00.000Z',
      updatedAt: NOW_ISO,
    });
    expect(timeline.events).toEqual([]);
  });

  it('answers a missing note with 404', async () => {
    const { service } = await serviceWithFakes();

    await expect(service.update(OLENA_ID, { ...MISSING_NOTE, input: INPUT })).rejects.toMatchObject(
      NOTE_NOT_FOUND,
    );
  });
});

describe('NotesService.remove', () => {
  it('answers a missing note with 404', async () => {
    const { service } = await serviceWithFakes();

    await expect(service.remove(OLENA_ID, MISSING_NOTE)).rejects.toMatchObject(NOTE_NOT_FOUND);
  });
});
