import {
  type Note,
  type NoteInput,
  noteInputSchema,
  type NoteListResponse,
  noteSchema,
} from '@jobflow/shared';
import { http, HttpResponse } from 'msw/http';

import { FULL_CARD } from '@/entities/application';

import { apiUrl, idempotencyKeyOf, type SentCreate } from './api-handlers';
import { heldReply, type MoveRouteOptions } from './board-fixtures';

export type NoteSeed = Pick<Note, 'applicationId' | 'body'> & Partial<Note>;

export type NotesRouteOptions = MoveRouteOptions & { items?: readonly Note[] };

type NoteParams = { id: string; noteId: string };

const NOTE_PATH = '/applications/:id/notes/:noteId';

export const NOTE_ID = '0b6f3c1e-5d2a-4c8e-9f10-0000000000ee';

export function noteOf(seed: NoteSeed): Note {
  const at = FULL_CARD.lastEventAt;
  return noteSchema.parse({ id: NOTE_ID, createdAt: at, updatedAt: at, ...seed });
}

export function noteRoute(control: MoveRouteOptions = {}) {
  const sent: SentCreate<NoteInput>[] = [];
  const handler = http.post<{ id: string }>(apiUrl('/applications/:id/notes'), async (info) => {
    const body = noteInputSchema.parse(await info.request.json());
    sent.push({ id: info.params.id, body, idempotencyKey: idempotencyKeyOf(info.request.headers) });
    const note = noteOf({ applicationId: info.params.id, body: body.body });
    return heldReply({
      ...control,
      info,
      fallback: () => HttpResponse.json(note, { status: 201 }),
    });
  });
  return { handler, sent };
}

export function notesRoute({ items = [], ...control }: NotesRouteOptions = {}) {
  const sent: string[] = [];
  const handler = http.get<{ id: string }>(apiUrl('/applications/:id/notes'), (info) => {
    sent.push(info.params.id);
    const list: NoteListResponse = { items: [...items] };
    return heldReply({ ...control, info, fallback: () => HttpResponse.json(list) });
  });
  return { handler, sent };
}

export function noteUpdateRoute(control: MoveRouteOptions = {}) {
  const sent: { noteId: string; body: NoteInput }[] = [];
  const handler = http.patch<NoteParams>(apiUrl(NOTE_PATH), async (info) => {
    const body = noteInputSchema.parse(await info.request.json());
    const { id, noteId } = info.params;
    sent.push({ noteId, body });
    const note = noteOf({ id: noteId, applicationId: id, body: body.body });
    return heldReply({ ...control, info, fallback: () => HttpResponse.json(note) });
  });
  return { handler, sent };
}

export function noteDeleteRoute(control: MoveRouteOptions = {}) {
  const sent: string[] = [];
  const handler = http.delete<NoteParams>(apiUrl(NOTE_PATH), (info) => {
    sent.push(info.params.noteId);
    const removed = () => new HttpResponse(null, { status: 204 });
    return heldReply({ ...control, info, fallback: removed });
  });
  return { handler, sent };
}
