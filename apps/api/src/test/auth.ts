import {
  type AuthResponse,
  authResponseSchema,
  type LoginInput,
  publicJwkSchema,
  type RefreshToken,
  type RegisterInput,
  type TokenScope,
} from '@jobflow/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { parseSetCookie, type SetCookie } from 'cookie';
import { generateKeyPair, jwtVerify } from 'jose';
import request, { type Response } from 'supertest';
import { z } from 'zod';

import type { User } from '../generated/prisma/client.js';
import { jwtKeysFrom, signAccessToken, signServiceToken } from '../modules/auth/index.js';

export const OLENA = {
  email: 'olena@example.test',
  password: 'olena-password-1',
  displayName: 'Олена',
} satisfies RegisterInput;

export const BOHDAN = {
  email: 'bohdan@example.test',
  password: 'bohdan-password-1',
} satisfies RegisterInput;

export const testKeys = await generateKeyPair('RS256');

export const testJwtKeys = await jwtKeysFrom(testKeys);

export const jwksResponseSchema = z.object({
  keys: z.tuple([publicJwkSchema.extend({ e: z.literal('AQAB') })]),
});

export type AccessTokenOptions = { issuedAt?: Date; scope?: readonly TokenScope[] };

export type ClientChoice = { mobile?: boolean };

export type SignInInput = LoginInput & ClientChoice;

export type SignUpInput = RegisterInput & ClientChoice;

export type SignedIn = AuthResponse & { refreshToken: RefreshToken };

export type RefreshInput = Pick<SignedIn, 'refreshToken'> & ClientChoice;

type Authentication = { path: 'register' | 'login'; body: object; mobile: boolean };

export function accessTokenFor(
  user: Pick<User, 'id'>,
  { issuedAt, scope }: AccessTokenOptions = {},
): Promise<string> {
  return signAccessToken({ keys: testJwtKeys, userId: user.id, issuedAt, scope });
}

export function serviceTokenFor(issuedAt = new Date()): Promise<string> {
  return signServiceToken({ keys: testJwtKeys, scope: 'ai:invoke', issuedAt });
}

export const TEST_KEY_HEADER = { alg: 'RS256', kid: testJwtKeys.jwk.kid };

export async function verifyWithTestKey(token: string, currentDate: Date) {
  const { payload, protectedHeader } = await jwtVerify(token, testJwtKeys.publicKey, {
    currentDate,
  });
  const { jti, ...claims } = payload;
  return { protectedHeader, jti, claims };
}

export async function authAs(app: NestExpressApplication, user: Pick<User, 'id'>) {
  const token = await accessTokenFor(user);
  return request.agent(app.getHttpServer()).set('authorization', `Bearer ${token}`);
}

export function setCookies(response: Response): string[] {
  const header: unknown = response.headers['set-cookie'];
  return Array.isArray(header) ? header.filter((value) => typeof value === 'string') : [];
}

export function cacheControlOf(...responses: Response[]): (string | undefined)[] {
  return responses.map((response) => response.get('cache-control'));
}

export const REFRESH_COOKIE_ATTRIBUTES = {
  name: 'refresh_token',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/api/v1/auth',
  maxAge: 2_592_000,
};

export function cookieOf(response: Response, cookieName: string): SetCookie | undefined {
  return setCookies(response)
    .map((line) => parseSetCookie(line))
    .find(({ name }) => name === cookieName);
}

export const clearedCookie = (path: string) => ({ value: '', path, expires: new Date(0) });

export const refreshCookieOf = (response: Response) => cookieOf(response, 'refresh_token');

export function refreshTokenFromCookie(response: Response): string {
  const value = refreshCookieOf(response)?.value;
  if (value === undefined) {
    throw new Error('The response set no refresh_token cookie');
  }
  return value;
}

export const refreshCookie = (token: string) => `refresh_token=${token}`;

export function refreshWith(
  app: NestExpressApplication,
  { refreshToken, mobile = false }: RefreshInput,
) {
  const call = request(app.getHttpServer()).post('/api/v1/auth/refresh');
  return mobile
    ? call.set('x-client', 'mobile').send({ refreshToken })
    : call.set('cookie', refreshCookie(refreshToken));
}

async function authenticate(
  app: NestExpressApplication,
  { path, body, mobile }: Authentication,
): Promise<SignedIn> {
  const call = request(app.getHttpServer()).post(`/api/v1/auth/${path}`);
  const response = await (mobile ? call.set('x-client', 'mobile') : call).send(body);
  const { user, accessToken, refreshToken } = authResponseSchema.parse(response.body);
  return { user, accessToken, refreshToken: refreshToken ?? refreshTokenFromCookie(response) };
}

export function signIn(
  app: NestExpressApplication,
  { mobile = false, email, password }: SignInInput,
): Promise<SignedIn> {
  return authenticate(app, { path: 'login', body: { email, password }, mobile });
}

export function signUp(
  app: NestExpressApplication,
  { mobile = false, ...input }: SignUpInput,
): Promise<SignedIn> {
  return authenticate(app, { path: 'register', body: input, mobile });
}
