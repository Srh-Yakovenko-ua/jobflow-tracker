import type { JwksResponse } from '@jobflow/shared';
import { Controller, Get } from '@nestjs/common';

import { JWKS_PATH } from '../../common/api-prefix.middleware.js';
import { JwtKeys } from './jwt-keys.js';
import { Public } from './public.decorator.js';

@Controller()
@Public()
export class JwksController {
  constructor(private readonly keys: JwtKeys) {}

  @Get(JWKS_PATH)
  jwks(): JwksResponse {
    return { keys: [this.keys.jwk] };
  }
}
