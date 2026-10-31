import {
  applicationTimelineResponseSchema,
  errorResponseSchema,
  noteListResponseSchema,
  noteSchema,
} from '@jobflow/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { Clock } from '../../common/clock.js';
import { appTestingModule, useTestApp } from '../../test/app.js';
import {
  applicationPath,
  foreignReaches,
  notePath,
  notesPath,
  type NoteTarget,
  type SignedInApplication,
  signUpWithApplication,
  timelinePath,
} from '../../test/applications.js';
import { callRoute, errorPathsOf, type RouteCall, statusAndDetail } from '../../test/http.js';
import { minutesAfter, NOW, settableClock } from '../../test/time.js';
import { NOTE_SELECT } from './notes.repository.js';

type SignedInNote = SignedInApplication & NoteTarget;

type NoteRoute = Omit<RouteCall, 'accessToken'>;

type NoteRoutes = Record<RouteCall['method'], NoteRoute>;

const NOW_ISO = '2026-10-22T09:00:00.000Z';

const NOTE_LINES = [
  "## Техінтерв'ю з тимлідом",
  '  - здався на DP за 20 хв, **повторити** графи',
  '<script>alert(1)</script>',
];

const NOTE_BODY = `${NOTE_LINES.join('\n')}\n`;

const EDITED = { body: 'Оновлена нотатка' };

const MISSING_NOTE = [404, 'Note not found'];

const MISSING_APPLICATION = [404, 'Application not found'];

const clock = settableClock(NOW);

const noteRoutes = (target: NoteTarget, body: object = EDITED): NoteRoutes => ({
  post: { method: 'post', path: notesPath(target.id), body },
  get: { method: 'get', path: notesPath(target.id) },
  patch: { method: 'patch', path: notePath(target), body },
  delete: { method: 'delete', path: notePath(target) },
});

describe('the notes routes', () => {
  const testApp = useTestApp(() => appTestingModule().overrideProvider(Clock).useValue(clock));

  beforeEach(() => {
    clock.at(NOW);
  });

  const call = (accessToken: string, route: NoteRoute) =>
    callRoute(testApp.app, { ...route, accessToken });

  const responsesOf = (accessToken: string, routes: NoteRoute[]) =>
    Promise.all(routes.map((route) => call(accessToken, route)));

  const postNote = ({ accessToken, id }: SignedInApplication, body: object) =>
    call(accessToken, { method: 'post', path: notesPath(id), body });

  const storedNote = (noteId: string) =>
    testApp.prisma.note.findUniqueOrThrow({ where: { id: noteId }, select: NOTE_SELECT });

  const journalRowsOf = (applicationId: string) =>
    testApp.prisma.timelineEvent.findMany({
      where: { applicationId },
      select: { kind: true, payload: true, occurredAt: true },
    });

  async function olenaWithNote(): Promise<SignedInNote> {
    const application = await signUpWithApplication(testApp.app);
    const response = await postNote(application, { body: NOTE_BODY });
    return { ...application, noteId: noteSchema.parse(response.body).id };
  }

  async function notesOf({ accessToken, id }: SignedInApplication) {
    const response = await call(accessToken, { method: 'get', path: notesPath(id) });
    return noteListResponseSchema.parse(response.body).items;
  }

  async function timelineNotesOf({ accessToken, id }: SignedInApplication) {
    const response = await call(accessToken, { method: 'get', path: timelinePath(id) });
    const { items } = applicationTimelineResponseSchema.parse(response.body);
    return items.filter(({ type }) => type === 'note_added');
  }

  it('POST answers 201 with the note and stores the markdown body byte for byte, script tag included', async () => {
    const application = await signUpWithApplication(testApp.app);

    const response = await postNote(application, { body: NOTE_BODY });

    expect(response.status).toBe(201);
    const { id, ...note } = noteSchema.parse(response.body);
    expect(note).toEqual({
      applicationId: application.id,
      body: NOTE_BODY,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
    });
    expect((await storedNote(id)).body).toBe(NOTE_BODY);
  });

  it('POST records one note_added journal row with the note id at the clock time', async () => {
    const { id, noteId } = await olenaWithNote();

    expect(await journalRowsOf(id)).toEqual([
      { kind: 'note_added', payload: { noteId }, occurredAt: NOW },
    ]);
  });

  it('GET timeline shows the note once as Заметка with its body', async () => {
    const note = await olenaWithNote();

    expect(await timelineNotesOf(note)).toEqual([
      {
        id: note.noteId,
        type: 'note_added',
        occurredAt: NOW_ISO,
        title: 'Заметка',
        meta: { body: NOTE_BODY },
        actor: 'user',
      },
    ]);
  });

  it('GET lists the notes of the application newest first', async () => {
    const first = await olenaWithNote();
    clock.at(minutesAfter(5));
    const second = noteSchema.parse((await postNote(first, { body: 'Друга нотатка' })).body);

    const notes = await notesOf(first);

    expect(notes.map(({ id, createdAt }) => ({ id, createdAt }))).toEqual([
      { id: second.id, createdAt: '2026-10-22T09:05:00.000Z' },
      { id: first.noteId, createdAt: NOW_ISO },
    ]);
  });

  it('PATCH changes the body and updatedAt, keeps createdAt and adds no journal row', async () => {
    const note = await olenaWithNote();
    clock.at(minutesAfter(30));

    const response = await call(note.accessToken, noteRoutes(note).patch);

    expect(response.status).toBe(200);
    expect(noteSchema.parse(response.body)).toEqual({
      id: note.noteId,
      applicationId: note.id,
      body: EDITED.body,
      createdAt: NOW_ISO,
      updatedAt: '2026-10-22T09:30:00.000Z',
    });
    expect(await journalRowsOf(note.id)).toHaveLength(1);
  });

  it('DELETE answers 204 and the note leaves the list and the timeline', async () => {
    const note = await olenaWithNote();

    const response = await call(note.accessToken, noteRoutes(note).delete);

    expect([response.status, response.text]).toEqual([204, '']);
    expect([await notesOf(note), await timelineNotesOf(note)]).toEqual([[], []]);
  });

  it.each([
    { case: 'no body field', body: {} },
    { case: 'a body of spaces and newlines', body: { body: ' \n \t' } },
    { case: 'a body one character over the limit', body: { body: 'ж'.repeat(20_001) } },
    { case: 'a NUL inside the body', body: { body: 'до\u0000після' } },
  ])('POST and PATCH answer $case with 422 at body and keep the note', async ({ body }) => {
    const note = await olenaWithNote();
    const before = await storedNote(note.noteId);
    const { post, patch } = noteRoutes(note, body);

    const responses = await responsesOf(note.accessToken, [post, patch]);

    expect(responses.map((response) => [response.status, errorPathsOf(response.body)])).toEqual([
      [422, ['body']],
      [422, ['body']],
    ]);
    expect(await storedNote(note.noteId)).toEqual(before);
    expect(await testApp.prisma.note.count()).toBe(1);
  });

  it('PATCH and DELETE answer a malformed note id with 422', async () => {
    const note = await olenaWithNote();
    const { patch, delete: remove } = noteRoutes({ ...note, noteId: 'not-a-uuid' });

    const responses = await responsesOf(note.accessToken, [patch, remove]);

    expect(
      responses.map(({ status, body }) => [status, errorResponseSchema.parse(body).type]),
    ).toEqual([
      [422, 'validation_error'],
      [422, 'validation_error'],
    ]);
  });

  it('POST accepts a Cyrillic body of exactly 20 000 characters', async () => {
    const application = await signUpWithApplication(testApp.app);
    const body = 'ж'.repeat(20_000);

    const response = await postNote(application, { body });

    expect(response.status).toBe(201);
    expect(noteSchema.parse(response.body).body).toBe(body);
  });

  it.each(foreignReaches<SignedInNote>(testApp, 'note'))(
    'PATCH and DELETE answer $case with 404 and keep the note',
    async ({ reach }) => {
      const note = await olenaWithNote();
      const before = await storedNote(note.noteId);
      const target = await reach(note);
      const { patch, delete: remove } = noteRoutes(target);

      const responses = await responsesOf(target.accessToken, [patch, remove]);

      expect(responses.map(statusAndDetail)).toEqual([MISSING_NOTE, MISSING_NOTE]);
      expect(await storedNote(note.noteId)).toEqual(before);
    },
  );

  it('answers every notes route on a soft-deleted application with 404 and keeps the note', async () => {
    const note = await olenaWithNote();
    const before = await storedNote(note.noteId);
    await call(note.accessToken, { method: 'delete', path: applicationPath(note.id) });

    const responses = await responsesOf(note.accessToken, Object.values(noteRoutes(note)));

    expect(responses.map(statusAndDetail)).toEqual([
      MISSING_APPLICATION,
      MISSING_APPLICATION,
      MISSING_NOTE,
      MISSING_NOTE,
    ]);
    expect(await storedNote(note.noteId)).toEqual(before);
    expect(await testApp.prisma.note.count()).toBe(1);
  });

  it('keeps every line of the note out of the application read that vacancy data comes from', async () => {
    const note = await olenaWithNote();

    const response = await call(note.accessToken, {
      method: 'get',
      path: applicationPath(note.id),
    });

    expect(response.status).toBe(200);
    expect(NOTE_LINES.filter((line) => response.text.includes(line))).toEqual([]);
  });
});
