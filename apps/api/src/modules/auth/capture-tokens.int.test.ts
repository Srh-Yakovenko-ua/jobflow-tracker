import { createHash } from 'node:crypto';

import { captureTokenCreatedSchema } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../openapi/document.js';
import { useTestApp } from '../../test/app.js';
import { signedInWithSearch } from '../../test/applications.js';
import { cacheControlOf } from '../../test/auth.js';
import {
  BOOKMARKLET,
  CAPTURE_TOKENS_PATH,
  captureAuthorization,
  issueCaptureToken,
  postBookmarklet,
  signedInWithCaptureToken,
} from '../../test/capture.js';
import { callRoute, statusAndDetail } from '../../test/http.js';
import { bearerCalls } from '../../test/openapi.js';

type TokenTarget = { accessToken?: string; id: string };

const BEARER_CALLS = bearerCalls(buildOpenApiDocument());

const INVALID_TOKEN = [401, 'Invalid capture token'];

const TOKEN_NOT_FOUND = [404, 'Capture token not found'];

const UNKNOWN_TOKEN_ID = '0199f4c2-3d4e-7f50-8a61-7c8d9e0f1a2b';

describe('capture tokens', () => {
  const testApp = useTestApp();

  const createToken = (accessToken?: string) =>
    callRoute(testApp.app, { method: 'post', path: CAPTURE_TOKENS_PATH, accessToken });

  const revokeToken = ({ accessToken, id }: TokenTarget) =>
    callRoute(testApp.app, {
      method: 'delete',
      path: `${CAPTURE_TOKENS_PATH}/${id}`,
      accessToken,
    });

  const captureWith = (captureToken: string) =>
    postBookmarklet(testApp.app, { captureToken, input: BOOKMARKLET });

  const storedTokens = () => testApp.prisma.captureToken.findMany({ orderBy: { id: 'asc' } });

  const draftCount = () => testApp.prisma.application.count();

  it('answers 201 with the capture token once and stores only its SHA-256', async () => {
    const { userId, accessToken } = await signedInWithSearch(testApp.prisma);

    const response = await createToken(accessToken);

    const created = captureTokenCreatedSchema.parse(response.body);
    const rows = await storedTokens();
    expect(response.status).toBe(201);
    expect(response.body).toEqual(created);
    expect(created.token).toMatch(/^[\w-]{43}$/);
    expect(cacheControlOf(response)).toEqual(['no-store']);
    expect(rows).toEqual([
      expect.objectContaining({
        id: created.id,
        userId,
        tokenHash: createHash('sha256').update(created.token).digest('hex'),
        lastUsedAt: null,
        revokedAt: null,
      }),
    ]);
    expect(JSON.stringify(rows)).not.toContain(created.token);
  });

  it('revokes the capture token the user had when a second one is created', async () => {
    const first = await signedInWithCaptureToken(testApp);
    expect((await captureWith(first.captureToken)).status).toBe(202);

    const second = await issueCaptureToken(testApp.app, first.accessToken);

    expect(statusAndDetail(await captureWith(first.captureToken))).toEqual(INVALID_TOKEN);
    expect((await captureWith(second.token)).status).toBe(202);
    expect((await storedTokens()).map(({ id, revokedAt }) => [id, revokedAt !== null])).toEqual([
      [first.captureTokenId, true],
      [second.id, false],
    ]);
    expect(await draftCount()).toBe(2);
  });

  it('answers 204 to a revoke, then 401 to the revoked token on the bookmarklet route with no new row, and 404 to a second revoke', async () => {
    const {
      accessToken,
      captureTokenId: id,
      captureToken,
    } = await signedInWithCaptureToken(testApp);
    expect((await captureWith(captureToken)).status).toBe(202);
    const [used] = await storedTokens();

    const revoked = await revokeToken({ accessToken, id });
    const refused = await captureWith(captureToken);
    const repeated = await revokeToken({ accessToken, id });

    expect(used?.lastUsedAt).toBeInstanceOf(Date);
    expect(statusAndDetail(revoked)).toEqual([204, undefined]);
    expect(statusAndDetail(refused)).toEqual(INVALID_TOKEN);
    expect(refused.get('www-authenticate')).toBe('Capture error="invalid_token"');
    expect(await draftCount()).toBe(1);
    expect(statusAndDetail(repeated)).toEqual(TOKEN_NOT_FOUND);
  });

  it("answers 404 to a revoke of another user's capture token, which still captures for its owner", async () => {
    const olena = await signedInWithCaptureToken(testApp);
    const bohdan = await signedInWithSearch(testApp.prisma);
    const id = olena.captureTokenId;

    const foreign = await revokeToken({ accessToken: bohdan.accessToken, id });

    expect(statusAndDetail(foreign)).toEqual(TOKEN_NOT_FOUND);
    expect((await captureWith(olena.captureToken)).status).toBe(202);
    expect((await revokeToken({ accessToken: olena.accessToken, id })).status).toBe(204);
  });

  it("leaves another user's capture token alone when a user creates theirs", async () => {
    const olena = await signedInWithCaptureToken(testApp);

    const bohdan = await signedInWithCaptureToken(testApp);

    expect((await captureWith(olena.captureToken)).status).toBe(202);
    expect((await captureWith(bohdan.captureToken)).status).toBe(202);
    expect((await storedTokens()).map(({ revokedAt }) => revokedAt)).toEqual([null, null]);
  });

  it('answers 401 to a capture token that was never issued and stores nothing', async () => {
    await signedInWithCaptureToken(testApp);

    const response = await captureWith('never-issued-capture-token');

    expect(statusAndDetail(response)).toEqual(INVALID_TOKEN);
    expect(await draftCount()).toBe(0);
  });

  it('answers 401 without a token to a create and to a revoke, and stores no token', async () => {
    const created = await createToken();
    const revoked = await revokeToken({ id: UNKNOWN_TOKEN_ID });

    expect([created.status, revoked.status]).toEqual([401, 401]);
    expect(await storedTokens()).toEqual([]);
  });

  it('answers 404 to a revoke of an id that is no capture token and 422 to one that is not a uuid', async () => {
    const { accessToken } = await signedInWithCaptureToken(testApp);

    const unknown = await revokeToken({ accessToken, id: UNKNOWN_TOKEN_ID });
    const malformed = await revokeToken({ accessToken, id: 'not-a-uuid' });

    expect(statusAndDetail(unknown)).toEqual(TOKEN_NOT_FOUND);
    expect(malformed.status).toBe(422);
  });

  it.each(BEARER_CALLS)(
    'answers the bearer route $name called with a live capture token with 403',
    async ({ call }) => {
      const { captureToken } = await signedInWithCaptureToken(testApp);

      const response = await callRoute(testApp.app, {
        ...call,
        headers: captureAuthorization(captureToken),
      });

      expect(statusAndDetail(response)).toEqual([403, 'Token lacks the user scope']);
    },
  );
});
