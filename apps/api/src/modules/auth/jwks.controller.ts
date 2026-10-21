import { Controller, Get } from '@nestjs/common';

import { JWKS_PATH } from '../../common/api-prefix.middleware.js';
import { JwtKeys, type PublicJwk } from './jwt-keys.js';

export type JwksResponse = { keys: PublicJwk[] };

@Controller()
export class JwksController {
  constructor(private readonly keys: JwtKeys) {}

  @Get(JWKS_PATH)
  jwks(): JwksResponse {
    return { keys: [this.keys.jwk] };
  }
}
