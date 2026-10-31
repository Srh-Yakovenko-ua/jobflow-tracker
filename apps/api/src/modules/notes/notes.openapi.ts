import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  type Note,
  NOTE_LIMITS,
  noteIdSchema,
  type NoteInput,
  noteInputSchema,
  noteListResponseSchema,
  noteSchema,
} from '@jobflow/shared';

import {
  applicationIdParams,
  errorResponses,
  EXAMPLE_CHILD_ROW,
  EXAMPLE_EDITED_AT,
  jsonContent,
} from '../../openapi/route.js';

const EXAMPLE_NOTE_ID = '0199f1d6-3b4c-7d5e-8f60-7a8b9c0d1e2f';

const NOTE_INPUT = {
  body: "## Технічне інтерв'ю\n\n- Спитати про on-call\n- Повторити індекси в PostgreSQL",
} satisfies NoteInput;

const NOTE = { ...NOTE_INPUT, id: EXAMPLE_NOTE_ID, ...EXAMPLE_CHILD_ROW } satisfies Note;

const NOTES_PATH = '/applications/{id}/notes';

const NOTE_PATH = `${NOTES_PATH}/{noteId}`;

const TAGS = ['applications'];

const noteParams = applicationIdParams.extend({
  noteId: noteIdSchema.meta({ example: EXAMPLE_NOTE_ID }),
});

const noteBody = {
  required: true,
  description: `Markdown, stored as sent: no trim, no sanitising, at most ${String(NOTE_LIMITS.bodyMaxLength)} characters, not blank.`,
  content: jsonContent(noteInputSchema, NOTE_INPUT),
};

const ownedErrors = errorResponses([401, 403, 404, 422]);

const bodyErrors = errorResponses([400, 401, 403, 404, 422]);

export const NOTES_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'post',
    path: NOTES_PATH,
    tags: TAGS,
    summary: 'Add a note to an Application',
    description: 'Stores the note and its note_added timeline row in one transaction.',
    request: { params: applicationIdParams, body: noteBody },
    responses: {
      201: { description: 'The created note', content: jsonContent(noteSchema, NOTE) },
      ...bodyErrors,
    },
  },
  {
    method: 'get',
    path: NOTES_PATH,
    tags: TAGS,
    summary: 'List the notes of an Application',
    description: 'Every note of the Application, newest first, in one list.',
    request: { params: applicationIdParams },
    responses: {
      200: {
        description: 'The notes of the Application',
        content: jsonContent(noteListResponseSchema, { items: [NOTE] }),
      },
      ...ownedErrors,
    },
  },
  {
    method: 'patch',
    path: NOTE_PATH,
    tags: TAGS,
    summary: 'Change the body of a note',
    request: { params: noteParams, body: noteBody },
    responses: {
      200: {
        description: 'The changed note',
        content: jsonContent(noteSchema, { ...NOTE, updatedAt: EXAMPLE_EDITED_AT }),
      },
      ...bodyErrors,
    },
  },
  {
    method: 'delete',
    path: NOTE_PATH,
    tags: TAGS,
    summary: 'Delete a note',
    request: { params: noteParams },
    responses: { 204: { description: 'The note is deleted' }, ...ownedErrors },
  },
];
