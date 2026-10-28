import { oauthProviderSchema } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import type { JWTVerifyOptions } from 'jose';
import { z } from 'zod';

import { type AppError, errorFor } from '../../common/app-error.js';
import { JwtKeys, signWithKeys, verifyWithKeys } from './jwt-keys.js';

export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

const OAUTH_STATE_TYPE = 'oauth-state+jwt';

const VERIFY_OPTIONS: JWTVerifyOptions = {
  algorithms: ['RS256'],
  typ: OAUTH_STATE_TYPE,
  requiredClaims: ['exp'],
};

const oauthStateSchema = z.object({
  provider: oauthProviderSchema,
  state: z.string().min(1),
  codeVerifier: z.string().min(1),
});

export type OAuthState = z.infer<typeof oauthStateSchema>;

const invalidState = (): AppError => errorFor(400, 'OAuth state is missing or invalid');

@Injectable()
export class OAuthStates {
  constructor(private readonly keys: JwtKeys) {}

  sign(state: OAuthState, issuedAt = new Date()): Promise<string> {
    return signWithKeys({
      keys: this.keys,
      claims: state,
      ttlSeconds: OAUTH_STATE_TTL_SECONDS,
      issuedAt,
      header: { typ: OAUTH_STATE_TYPE },
    });
  }

  verify(token: string | undefined): Promise<OAuthState> {
    return verifyWithKeys({
      keys: this.keys,
      token: token ?? '',
      options: VERIFY_OPTIONS,
      schema: oauthStateSchema,
      refusal: invalidState,
    });
  }
}
