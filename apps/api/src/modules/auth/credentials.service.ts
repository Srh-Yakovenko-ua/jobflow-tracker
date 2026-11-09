import { Injectable } from '@nestjs/common';

import { AccessTokens, type AccessUser } from './access-tokens.js';
import { CaptureTokensService } from './capture-tokens.service.js';

export type Credentials = { scheme: 'bearer' | 'capture'; token: string };

@Injectable()
export class CredentialsService {
  constructor(
    private readonly accessTokens: AccessTokens,
    private readonly captureTokens: CaptureTokensService,
  ) {}

  verify({ scheme, token }: Credentials): Promise<AccessUser> {
    const verifier = scheme === 'capture' ? this.captureTokens : this.accessTokens;
    return verifier.verify(token);
  }
}
