import { type Note, noteSchema } from '@jobflow/shared';

import { apiClient } from '@/shared/api';

import type { AddNoteRequest } from './add-note';

export type UpdateNoteRequest = Omit<AddNoteRequest, 'idempotencyKey'> &
  Readonly<{ noteId: Note['id'] }>;

export function updateNote({ applicationId, noteId, body }: UpdateNoteRequest): Promise<Note> {
  return apiClient.request({
    path: `/applications/${applicationId}/notes/${noteId}`,
    method: 'PATCH',
    body,
    schema: noteSchema,
    keepalive: true,
  });
}
