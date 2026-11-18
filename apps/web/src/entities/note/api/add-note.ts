import { type ApplicationCard, type Note, type NoteInput, noteSchema } from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export type AddNoteRequest = Readonly<{
  applicationId: ApplicationCard['id'];
  body: NoteInput;
  idempotencyKey: string;
  keepalive: boolean;
}>;

export function addNote({
  applicationId,
  body,
  idempotencyKey,
  keepalive,
}: AddNoteRequest): Promise<Note> {
  return apiClient.request({
    path: `/applications/${applicationId}/notes`,
    method: 'POST',
    body,
    schema: noteSchema,
    keepalive,
    idempotencyKey,
  });
}
