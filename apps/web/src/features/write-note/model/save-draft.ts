import type { Note, NoteListResponse } from '@jobflow/shared';
import type { RefObject } from 'react';

import { addNote, deleteNote, updateNote } from '@/entities/note';

export type PendingCreate = Readonly<{ key: string; body: string }>;

export type DraftRecord = {
  noteId: Note['id'] | null;
  savedBody: string;
  pendingCreate: PendingCreate | null;
};

export type DraftSaved =
  | { kind: 'unchanged' }
  | { kind: 'written'; note: Note; created: boolean }
  | { kind: 'deleted'; noteId: Note['id'] };

export type SaveDraftInput = Readonly<{
  applicationId: Note['applicationId'];
  draft: RefObject<DraftRecord>;
  body: string;
  keepalive: boolean;
}>;

export const EMPTY_DRAFT: DraftRecord = { noteId: null, savedBody: '', pendingCreate: null };

type PendingPost = Pick<SaveDraftInput, 'applicationId' | 'keepalive'> &
  Readonly<{ create: PendingCreate }>;

const UNCHANGED: DraftSaved = { kind: 'unchanged' };

function postPending({ applicationId, create, keepalive }: PendingPost): Promise<Note> {
  return addNote({
    applicationId,
    body: { body: create.body },
    idempotencyKey: create.key,
    keepalive,
  });
}

async function createDraft(input: SaveDraftInput): Promise<Note> {
  const { applicationId, draft, body, keepalive } = input;
  const create = draft.current.pendingCreate ?? { key: crypto.randomUUID(), body };
  draft.current = { ...draft.current, pendingCreate: create };
  const created = await postPending({ applicationId, create, keepalive });
  if (body === create.body) return created;
  return updateNote({ applicationId, noteId: created.id, body: { body }, keepalive });
}

async function writeDraft(input: SaveDraftInput): Promise<DraftSaved> {
  const { applicationId, draft, body, keepalive } = input;
  const { noteId } = draft.current;
  const note =
    noteId === null
      ? await createDraft(input)
      : await updateNote({ applicationId, noteId, body: { body }, keepalive });
  if (draft.current.noteId !== noteId) return UNCHANGED;
  draft.current = { noteId: note.id, savedBody: body, pendingCreate: null };
  return { kind: 'written', note, created: noteId === null };
}

async function removeDraft(input: SaveDraftInput): Promise<DraftSaved> {
  const { applicationId, draft, keepalive } = input;
  const { pendingCreate } = draft.current;
  const noteId =
    draft.current.noteId ??
    (pendingCreate === null
      ? null
      : (await postPending({ applicationId, create: pendingCreate, keepalive })).id);
  if (noteId === null) return UNCHANGED;
  await deleteNote({ applicationId, noteId, keepalive });
  draft.current = EMPTY_DRAFT;
  return { kind: 'deleted', noteId };
}

export function saveDraft(input: SaveDraftInput): Promise<DraftSaved> {
  const { savedBody, pendingCreate } = input.draft.current;
  if (input.body === savedBody && pendingCreate === null) return Promise.resolve(UNCHANGED);
  return input.body.trim() === '' ? removeDraft(input) : writeDraft(input);
}

export function notesAfter(list: NoteListResponse, saved: DraftSaved): NoteListResponse {
  if (saved.kind === 'unchanged') return list;
  if (saved.kind === 'deleted') {
    return { items: list.items.filter((note) => note.id !== saved.noteId) };
  }
  const known = list.items.some((note) => note.id === saved.note.id);
  const items = known
    ? list.items.map((note) => (note.id === saved.note.id ? saved.note : note))
    : [saved.note, ...list.items];
  return { items };
}
