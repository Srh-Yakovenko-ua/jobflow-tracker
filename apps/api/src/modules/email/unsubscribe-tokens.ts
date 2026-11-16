import { randomUUID } from 'node:crypto';

import { type EmailedType, emailedTypeSchema } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { secondsInDay } from 'date-fns/constants';
import type { JWTVerifyOptions } from 'jose';
import { z } from 'zod';

import { unauthorized } from '../../common/app-error.js';
import { JwtKeys, signWithKeys, verifyWithKeys } from '../auth/index.js';

export const EMAIL_LIMITS = { unsubscribeTtlDays: 365 } as const;

export type UnsubscribeClaims = { userId: string; type: EmailedType };

export type SignUnsubscribeToken = UnsubscribeClaims & { issuedAt: Date };

const UNSUBSCRIBE_TOKEN = {
  issuer: 'jobflow-api',
  audience: 'jobflow-email',
  typ: 'unsubscribe+jwt',
} as const;

const VERIFY_OPTIONS: JWTVerifyOptions = {
  algorithms: ['RS256'],
  ...UNSUBSCRIBE_TOKEN,
  requiredClaims: ['sub', 'email', 'exp'],
};

const unsubscribeClaimsSchema = z.object({ sub: z.uuid(), email: emailedTypeSchema });

@Injectable()
export class UnsubscribeTokens {
  constructor(private readonly keys: JwtKeys) {}

  sign({ userId, type, issuedAt }: SignUnsubscribeToken): Promise<string> {
    return signWithKeys({
      keys: this.keys,
      claims: {
        iss: UNSUBSCRIBE_TOKEN.issuer,
        aud: UNSUBSCRIBE_TOKEN.audience,
        sub: userId,
        email: type,
        jti: randomUUID(),
      },
      ttlSeconds: EMAIL_LIMITS.unsubscribeTtlDays * secondsInDay,
      issuedAt,
      header: { typ: UNSUBSCRIBE_TOKEN.typ },
    });
  }

  async verify(token: string): Promise<UnsubscribeClaims> {
    const { sub, email } = await verifyWithKeys({
      keys: this.keys,
      token,
      options: VERIFY_OPTIONS,
      schema: unsubscribeClaimsSchema,
      refusal: () => unauthorized('Invalid unsubscribe link'),
    });
    return { userId: sub, type: email };
  }
}
