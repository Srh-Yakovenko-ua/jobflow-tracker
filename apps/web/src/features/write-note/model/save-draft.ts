import type { Note, NoteListResponse } from '@jobflow/shared';
import type { RefObject } from 'react';

import { addNote, deleteNote, updateNote } from '@/entities/note';

export type DraftRecord = { noteId: Note['id'] | null; savedBody: string };

export type DraftSaved =
  | { kind: 'unchanged' }
  | { kind: 'written'; note: Note; created: boolean }
  | { kind: 'deleted'; noteId: Note['id'] };

export type SaveDraftInput = Readonly<{
  applicationId: Note['applicationId'];
  draft: RefObject<DraftRecord>;
  body: string;
}>;

export const EMPTY_DRAFT: DraftRecord = { noteId: null, savedBody: '' };

const UNCHANGED: DraftSaved = { kind: 'unchanged' };

async function writeDraft({ applicationId, draft, body }: SaveDraftInput): Promise<DraftSaved> {
  const { noteId } = draft.current;
  const input = { applicationId, body: { body } };
  const note = noteId === null ? await addNote(input) : await updateNote({ ...input, noteId });
  draft.current = { noteId: note.id, savedBody: body };
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
