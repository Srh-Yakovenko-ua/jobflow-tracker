import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import { oauthCodeQuerySchema, oauthErrorQuerySchema, oauthProviderSchema } from '@jobflow/shared';
import { z } from 'zod';

import { errorResponses, PUBLIC } from '../../openapi/route.js';
import { OAUTH_STATE_COOKIE } from './oauth-state-cookie.js';
import { REFRESH_COOKIE } from './refresh-cookie.js';

const TAGS = ['auth'];

const providerParams = z.object({ provider: oauthProviderSchema.meta({ example: 'github' }) });

const callbackQuery = oauthCodeQuerySchema.partial().extend(oauthErrorQuerySchema.partial().shape);

type RedirectHeaders = { location: string; cookies: string };

const redirectHeaders = ({ location, cookies }: RedirectHeaders) =>
  z.object({
    Location: z.string().meta({ description: location }),
    'Set-Cookie': z.string().meta({ description: cookies }),
  });

export const OAUTH_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: '/auth/oauth/{provider}/start',
    tags: TAGS,
    summary: 'Start a sign-in with Google or GitHub',
    description:
      'Redirects to the provider with state and a PKCE challenge; 404 when the provider has no credentials.',
    ...PUBLIC,
    request: { params: providerParams },
    responses: {
      302: {
        description: 'Redirect to the provider',
        headers: redirectHeaders({
          location: "The provider's authorization URL",
          cookies: `Sets the httpOnly ${OAUTH_STATE_COOKIE} cookie for ten minutes`,
        }),
      },
      ...errorResponses([404, 422]),
    },
  },
  {
    method: 'get',
    path: '/auth/oauth/{provider}/callback',
    tags: TAGS,
    summary: 'Finish a sign-in with Google or GitHub',
    description: `Takes code and state, or the provider's error when the user declined. Links the provider account by verified email, dropping a password and the sessions it opened, or creates a user without a password. 400 when state does not match the ${OAUTH_STATE_COOKIE} cookie, 409 when the user already has another account of the provider, 422 without code and state or error, 503 when the provider is not reachable.`,
    ...PUBLIC,
    request: { params: providerParams, query: callbackQuery },
    responses: {
      302: {
        description:
          'Signed in, redirect to the board; declined at the provider, redirect to sign-in',
        headers: redirectHeaders({
          location: 'The board of the web app, or its sign-in page with oauth=denied',
          cookies: `Clears ${OAUTH_STATE_COOKIE}; on sign-in sets the httpOnly ${REFRESH_COOKIE} cookie`,
        }),
      },
      ...errorResponses([400, 404, 409, 422, 503]),
    },
  },
];
