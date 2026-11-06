import { z } from 'zod';

import { apiClient } from '@/shared/api';

import type { UpdateNoteRequest } from './update-note';

export type DeleteNoteRequest = Omit<UpdateNoteRequest, 'body'>;

export function deleteNote({ applicationId, noteId }: DeleteNoteRequest): Promise<void> {
  return apiClient.request({
    path: `/applications/${applicationId}/notes/${noteId}`,
    method: 'DELETE',
    schema: z.void(),
    keepalive: true,
  });
}
