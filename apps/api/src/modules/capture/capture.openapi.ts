import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  type CapturePasteInput,
  capturePasteInputSchema,
  type CapturePasteResponse,
  capturePasteResponseSchema,
  VACANCY_PARSE_LIMITS,
} from '@jobflow/shared';

import {
  errorResponses,
  EXAMPLE_APPLICATION_ID,
  idempotencyHeaders,
  jsonContent,
} from '../../openapi/route.js';

const PASTE = {
  text: 'Senior React developer у Acme. Remote, 4000-5000 USD. React, TypeScript, Next.js.',
  url: 'https://djinni.co/jobs/700123-senior-react-developer/',
} satisfies CapturePasteInput;

const ACCEPTED = {
  applicationId: EXAMPLE_APPLICATION_ID,
  jobId: '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f1a',
  possibleDuplicates: [],
} satisfies CapturePasteResponse;

export const CAPTURE_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'post',
    path: '/capture/paste',
    tags: ['capture'],
    summary: 'Capture a vacancy from pasted text',
    description:
      'In one transaction stores a draft Application in the applied stage with the pasted text, its queued AI job, the captured timeline row and the application.capture_requested event. The worker parses the text later: a parse fills the draft and records ai_parsed, a failed one leaves the draft and keeps the text as a note. Answers before any AI call.',
    request: {
      headers: idempotencyHeaders,
      body: {
        required: true,
        description: `The vacancy text, not blank, at most ${String(VACANCY_PARSE_LIMITS.textMaxLength)} characters, and optionally the http(s) page it came from.`,
        content: jsonContent(capturePasteInputSchema, PASTE),
      },
    },
    responses: {
      202: {
        description:
          'The draft and its AI job are stored; possibleDuplicates lists Applications with the same url',
        content: jsonContent(capturePasteResponseSchema, ACCEPTED),
      },
      ...errorResponses([400, 401, 403, 409, 422], 'ai'),
    },
  },
];
