import type { ApplicationResponse, Note } from '@jobflow/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { timelineQueryOptions } from '@/entities/application';
import { notesQueryOptions } from '@/entities/note';
import { useUserTimeZone } from '@/entities/user';

import { noteContextOf } from '../lib/note-context';
import { sectionLoadOf } from './section-load';

export function useApplicationNotes(application: ApplicationResponse) {
  const notes = useQuery(notesQueryOptions(application.id));
  const timeline = useQuery(timelineQueryOptions(application.id));
  const timeZone = useUserTimeZone();
  const [draftNoteId, setDraftNoteId] = useState<Note['id'] | null>(null);
  const items = timeline.data?.items ?? [];
  const listed = (notes.data?.items ?? []).filter((note) => note.id !== draftNoteId);
  return {
    entries: listed.map((note) => ({ note, context: noteContextOf({ note, items, timeZone }) })),
    load: sectionLoadOf(notes),
    onDraftChange: setDraftNoteId,
  };
}

export type ApplicationNotes = ReturnType<typeof useApplicationNotes>;
