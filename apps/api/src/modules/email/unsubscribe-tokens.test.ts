import { subDays } from 'date-fns';
import { decodeJwt } from 'jose';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  accessTokenFor,
  serviceTokenFor,
  TEST_KEY_HEADER,
  testJwtKeys,
  unsubscribeTokenFor,
  verifyWithTestKey,
  withFlippedSignatureByte,
  withPayload,
} from '../../test/auth.js';
import { OLENA_ID } from '../../test/service-fixtures.js';
import { signWithKeys } from '../auth/index.js';
import { UnsubscribeTokens } from './unsubscribe-tokens.js';

const ISSUED_AT = new Date('2026-10-31T10:00:00.000Z');

const tokens = new UnsubscribeTokens(testJwtKeys);

const refusedTokens: [string, () => Promise<string>][] = [
  [
    'with a flipped signature byte',
    async () => withFlippedSignatureByte(await unsubscribeTokenFor(OLENA_ID)),
  ],
  [
    'whose email claim was changed',
    async () => {
      const token = await unsubscribeTokenFor(OLENA_ID);
      return withPayload(token, { ...decodeJwt(token), email: 'silence' });
    },
  ],
  ['that expired', () => unsubscribeTokenFor(OLENA_ID, { issuedAt: subDays(new Date(), 366) })],
  ['that is an access token', () => accessTokenFor({ id: OLENA_ID })],
  ['that is a service token', () => serviceTokenFor()],
  [
    'for a type that is never emailed',
    () =>
      signWithKeys({
        keys: testJwtKeys,
        claims: { iss: 'jobflow-api', aud: 'jobflow-email', sub: OLENA_ID, email: 'ai_done' },
        ttlSeconds: 60,
        issuedAt: new Date(),
        header: { typ: 'unsubscribe+jwt' },
      }),
  ],
];

describe('UnsubscribeTokens', () => {
  it('signs a one-year RS256 token for jobflow-email with the user as sub and the email type', async () => {
    const token = await unsubscribeTokenFor(OLENA_ID, { issuedAt: ISSUED_AT });

    const { protectedHeader, jti, claims } = await verifyWithTestKey(token, ISSUED_AT);
    expect(protectedHeader).toEqual({ ...TEST_KEY_HEADER, typ: 'unsubscribe+jwt' });
    expect(claims).toEqual({
      iss: 'jobflow-api',
      aud: 'jobflow-email',
      sub: OLENA_ID,
      email: 'monthly_summary_ready',
      iat: 1_793_440_800,
      exp: 1_824_976_800,
    });
    expect(jti).toEqual(expect.schemaMatching(z.uuid()));
  });

  it('answers the user and the email type of a token it signed', async () => {
    const token = await unsubscribeTokenFor(OLENA_ID, { type: 'interview_prep_ready' });

    await expect(tokens.verify(token)).resolves.toEqual({
      userId: OLENA_ID,
      type: 'interview_prep_ready',
    });
  });

  it.each(refusedTokens)('refuses a token %s with 401', async (_case, forge) => {
    await expect(tokens.verify(await forge())).rejects.toMatchObject({
      body: { status: 401, type: 'unauthorized', detail: 'Invalid unsubscribe link' },
    });
  });
});
