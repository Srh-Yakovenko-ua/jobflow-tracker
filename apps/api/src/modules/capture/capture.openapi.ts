import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  CAPTURE_BOOKMARKLET_LIMITS,
  type CaptureBookmarkletInput,
  captureBookmarkletInputSchema,
  type CapturePasteInput,
  capturePasteInputSchema,
  type CapturePasteResponse,
  capturePasteResponseSchema,
  VACANCY_PARSE_LIMITS,
} from '@jobflow/shared';

import {
  applicationIdParams,
  errorResponses,
  EXAMPLE_APPLICATION_ID,
  idempotencyHeaders,
  jsonContent,
} from '../../openapi/route.js';

const PASTE = {
  text: 'Senior React developer у Acme. Remote, 4000-5000 USD. React, TypeScript, Next.js.',
  url: 'https://djinni.co/jobs/700123-senior-react-developer/',
} satisfies CapturePasteInput;

const BOOKMARKLET = {
  ...PASTE,
  title: 'Senior React developer at Acme | Djinni',
  html: '<main><h1>Senior React developer</h1><p>Acme. Remote, 4000-5000 USD.</p></main>',
} satisfies CaptureBookmarkletInput;

const ACCEPTED = {
  applicationId: EXAMPLE_APPLICATION_ID,
  jobId: '0199f4b1-2c3d-7e4f-8a51-6b7c8d9e0f1a',
  possibleDuplicates: [],
} satisfies CapturePasteResponse;

const ACCEPTED_REPLY = {
  description:
    'The draft and its AI job are stored; possibleDuplicates lists Applications with the same url',
  content: jsonContent(capturePasteResponseSchema, ACCEPTED),
};

export const CAPTURE_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'post',
    path: '/capture/paste',
    tags: ['capture'],
    summary: 'Capture a vacancy from pasted text',
    description:
      'In one transaction stores a draft Application in the applied stage with the pasted text, its queued AI job, the captured timeline row and the application.capture_requested event. The worker parses the text later: a parse fills the fields the user has not changed meanwhile and records ai_parsed, a failed one leaves the draft and keeps the text as a note. Answers before any AI call.',
    request: {
      headers: idempotencyHeaders,
      body: {
        required: true,
        description: `The vacancy text, not blank, at most ${String(VACANCY_PARSE_LIMITS.textMaxLength)} characters, and optionally the http(s) page it came from.`,
        content: jsonContent(capturePasteInputSchema, PASTE),
      },
    },
    responses: { 202: ACCEPTED_REPLY, ...errorResponses([400, 401, 403, 409, 422], 'ai') },
  },
  {
    method: 'post',
    path: '/capture/bookmarklet',
    tags: ['capture'],
    summary: 'Capture a vacancy from the page the bookmarklet reads',
    description: `Takes the capture token as "Authorization: Capture <token>", from any origin and without cookies; a user access token answers 403. Stores the same draft, AI job, captured timeline row and event as a paste. The stored text is the title, a blank line and the page text, cut at ${String(VACANCY_PARSE_LIMITS.textMaxLength)} characters; when html is sent the server strips it to text and uses that instead of text. The source is set from the host for djinni.co, jobs.dou.ua, robota.ua and linkedin.com. The server never fetches the page.`,
    security: [{ captureToken: [] }],
    request: {
      headers: idempotencyHeaders,
      body: {
        required: true,
        description: `The page url, its title up to ${String(CAPTURE_BOOKMARKLET_LIMITS.titleMaxLength)} characters, its visible text and optionally its html. The whole body is at most ${String(CAPTURE_BOOKMARKLET_LIMITS.bodyMaxBytes / 1024)} KB.`,
        content: jsonContent(captureBookmarkletInputSchema, BOOKMARKLET),
      },
    },
    responses: {
      202: ACCEPTED_REPLY,
      ...errorResponses([400, 401, 403, 409, 413, 422], 'capture'),
    },
  },
  {
    method: 'post',
    path: '/capture/drafts/{id}/confirm',
    tags: ['capture'],
    summary: 'Confirm a draft',
    description:
      'Clears the draft flag of a captured Application, so it reads as a normal card, and in the same transaction records the draft_confirmed timeline row and the application.updated event with fields ["isDraft"]. A draft whose vacancy parse failed can be confirmed. Answers 409 for an Application that is not a draft ("Application is not a draft"), a repeated confirm included, and while its vacancy parse is still queued or processing ("Vacancy parse is still running").',
    request: { params: applicationIdParams },
    responses: {
      204: { description: 'The Application is no longer a draft' },
      ...errorResponses([401, 403, 404, 409, 422]),
    },
  },
];
