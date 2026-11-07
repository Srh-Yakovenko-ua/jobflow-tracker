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
}>;

export const EMPTY_DRAFT: DraftRecord = { noteId: null, savedBody: '', pendingCreate: null };

const UNCHANGED: DraftSaved = { kind: 'unchanged' };

async function createDraft({ applicationId, draft, body }: SaveDraftInput): Promise<Note> {
  const create = draft.current.pendingCreate ?? { key: crypto.randomUUID(), body };
  draft.current = { ...draft.current, pendingCreate: create };
  const created = await addNote({
    applicationId,
    body: { body: create.body },
    idempotencyKey: create.key,
  });
  if (body === create.body) return created;
  return updateNote({ applicationId, noteId: created.id, body: { body } });
}

async function writeDraft(input: SaveDraftInput): Promise<DraftSaved> {
  const { applicationId, draft, body } = input;
  const { noteId } = draft.current;
  const note =
    noteId === null
      ? await createDraft(input)
      : await updateNote({ applicationId, noteId, body: { body } });
  draft.current = { noteId: note.id, savedBody: body, pendingCreate: null };
  return { kind: 'written', note, created: noteId === null };
}

async function removeDraft({ applicationId, draft }: SaveDraftInput): Promise<DraftSaved> {
  const { noteId } = draft.current;
  if (noteId === null) return UNCHANGED;
  await deleteNote({ applicationId, noteId });
  draft.current = EMPTY_DRAFT;
  return { kind: 'deleted', noteId };
}

export function saveDraft(input: SaveDraftInput): Promise<DraftSaved> {
  if (input.body === input.draft.current.savedBody) return Promise.resolve(UNCHANGED);
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
