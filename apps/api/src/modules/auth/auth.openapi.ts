import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  authResponseSchema,
  changePasswordInputSchema,
  jwksResponseSchema,
  loginInputSchema,
  meResponseSchema,
  refreshTokenBodySchema,
  registerInputSchema,
  sessionTokensSchema,
} from '@jobflow/shared';
import { z } from 'zod';

import { JWKS_PATH } from '../../common/api-prefix.middleware.js';
import { errorResponses, jsonContent, PUBLIC } from '../../openapi/route.js';
import { AUTH_EXAMPLES } from './auth.openapi-examples.js';
import { CLIENT_HEADER, MOBILE_CLIENT, REFRESH_COOKIE } from './refresh-cookie.js';

const TAGS = ['auth'];

const MOBILE = `${CLIENT_HEADER}: ${MOBILE_CLIENT}`;

const clientHeaders = z.object({
  [CLIENT_HEADER]: z
    .literal(MOBILE_CLIENT)
    .optional()
    .meta({ description: `${MOBILE_CLIENT} gets the refresh token in the body, not as a cookie` }),
});

const sessionCookie = z.object({
  'Set-Cookie': z
    .string()
    .optional()
    .meta({ description: `Sets the httpOnly ${REFRESH_COOKIE} cookie; not sent with ${MOBILE}` }),
});

const clearedCookie = z.object({
  'Set-Cookie': z.string().meta({ description: `Clears the ${REFRESH_COOKIE} cookie` }),
});

const COOKIE_OR_BODY = [{ refreshCookie: [] }, {}];

const refreshBody = {
  required: false,
  description: `The refresh token, only with ${MOBILE}; a browser sends the ${REFRESH_COOKIE} cookie`,
  content: jsonContent(refreshTokenBodySchema, AUTH_EXAMPLES.refreshBody),
};

const signedIn = (description: string) => ({
  description,
  headers: sessionCookie,
  content: jsonContent(authResponseSchema, AUTH_EXAMPLES.authResponse),
});

export const AUTH_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'post',
    path: '/auth/register',
    tags: TAGS,
    summary: 'Register with email and password',
    description: '409 when the email is taken.',
    ...PUBLIC,
    request: {
      headers: clientHeaders,
      body: { required: true, content: jsonContent(registerInputSchema, AUTH_EXAMPLES.register) },
    },
    responses: {
      201: signedIn('Registered and signed in'),
      ...errorResponses([409, 422], 'register'),
    },
  },
  {
    method: 'post',
    path: '/auth/login',
    tags: TAGS,
    summary: 'Sign in with email and password',
    description: 'An unknown email and a wrong password get the same 401.',
    ...PUBLIC,
    request: {
      headers: clientHeaders,
      body: { required: true, content: jsonContent(loginInputSchema, AUTH_EXAMPLES.login) },
    },
    responses: { 200: signedIn('Signed in'), ...errorResponses([401, 422], 'login') },
  },
  {
    method: 'post',
    path: '/auth/refresh',
    tags: TAGS,
    summary: 'Rotate the refresh token',
    description:
      'Revokes the presented refresh token and issues new tokens in the same family; a reused token revokes the family.',
    security: COOKIE_OR_BODY,
    request: { headers: clientHeaders, body: refreshBody },
    responses: {
      200: {
        description: 'A new access token, and the refresh token in the body with the mobile header',
        headers: sessionCookie,
        content: jsonContent(sessionTokensSchema, AUTH_EXAMPLES.session),
      },
      ...errorResponses([401, 422]),
    },
  },
  {
    method: 'post',
    path: '/auth/logout',
    tags: TAGS,
    summary: 'Sign out of this session',
    security: COOKIE_OR_BODY,
    request: { headers: clientHeaders, body: refreshBody },
    responses: {
      204: { description: 'The session family is revoked', headers: clearedCookie },
      ...errorResponses([422]),
    },
  },
  {
    method: 'post',
    path: '/auth/logout-all',
    tags: TAGS,
    summary: 'Sign out of every session',
    responses: {
      204: { description: 'Every session of the user is revoked', headers: clearedCookie },
      ...errorResponses([401, 403]),
    },
  },
  {
    method: 'post',
    path: '/auth/change-password',
    tags: TAGS,
    summary: 'Change the password',
    description: `Keeps the session of the ${REFRESH_COOKIE} cookie and revokes the others; 422 when currentPassword is wrong.`,
    request: {
      body: {
        required: true,
        content: jsonContent(changePasswordInputSchema, AUTH_EXAMPLES.changePassword),
      },
    },
    responses: {
      204: { description: 'The password is changed' },
      ...errorResponses([401, 403, 422]),
    },
  },
  {
    method: 'get',
    path: '/auth/me',
    tags: TAGS,
    summary: 'The signed-in user and their settings',
    responses: {
      200: {
        description: 'The user and their settings',
        content: jsonContent(meResponseSchema, AUTH_EXAMPLES.me),
      },
      ...errorResponses([401, 403]),
    },
  },
  {
    method: 'get',
    path: `/${JWKS_PATH}`,
    tags: TAGS,
    summary: 'The public key that verifies access tokens',
    ...PUBLIC,
    servers: [{ url: '/' }],
    responses: {
      200: {
        description: 'One RS256 signing key',
        content: jsonContent(jwksResponseSchema, AUTH_EXAMPLES.jwks),
      },
      ...errorResponses([]),
    },
  },
];
