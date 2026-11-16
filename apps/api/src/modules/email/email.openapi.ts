import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import { emailUnsubscribeInputSchema, emailUnsubscribeResponseSchema } from '@jobflow/shared';

import { errorResponses, jsonContent, PUBLIC } from '../../openapi/route.js';
import { EMAIL_LIMITS } from './unsubscribe-tokens.js';

const EXAMPLE_UNSUBSCRIBE_TOKEN =
  'eyJhbGciOiJSUzI1NiJ9.eyJlbWFpbCI6Im1vbnRobHlfc3VtbWFyeV9yZWFkeSJ9.c2lnbmF0dXJl';

export const EMAIL_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'post',
    path: '/email/unsubscribe',
    tags: ['email'],
    summary: 'Turn off one email type from the link in an email',
    description: `No sign-in: the token from the email link names the user and the email type, signed by the API for the jobflow-email audience and valid for ${String(EMAIL_LIMITS.unsubscribeTtlDays)} days. The type's setting turns off and settings.changed is recorded. A bad, tampered, expired or foreign token answers 401.`,
    ...PUBLIC,
    request: {
      body: {
        required: true,
        content: jsonContent(emailUnsubscribeInputSchema, { token: EXAMPLE_UNSUBSCRIBE_TOKEN }),
      },
    },
    responses: {
      200: {
        description: 'The email type that was turned off',
        content: jsonContent(emailUnsubscribeResponseSchema, { type: 'monthly_summary_ready' }),
      },
      ...errorResponses([400, 401, 422]),
    },
  },
];
