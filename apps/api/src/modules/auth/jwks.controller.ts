import { Controller, Get } from '@nestjs/common';

import { JWKS_PATH } from '../../common/api-prefix.middleware.js';
import { JwtKeys, type PublicJwk } from './jwt-keys.js';
import { Public } from './public.decorator.js';

export type JwksResponse = { keys: PublicJwk[] };

@Controller()
@Public()
export class JwksController {
  constructor(private readonly keys: JwtKeys) {}

  @Get(JWKS_PATH)
  jwks(): JwksResponse {
    return { keys: [this.keys.jwk] };
  }
}
