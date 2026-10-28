import {
  type OAuthCallbackQuery,
  oauthCallbackQuerySchema,
  type OAuthProvider,
  oauthProviderSchema,
} from '@jobflow/shared';
import { Controller, Get, Param, Query, Redirect, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { OAuthService } from './oauth.service.js';
import { oauthStateCookie } from './oauth-state-cookie.js';
import { Public } from './public.decorator.js';
import { sendSession } from './refresh-cookie.js';
import { SessionService } from './session.service.js';

export type RedirectTarget = { url: string };

@Controller('auth/oauth')
@Public()
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly sessions: SessionService,
  ) {}

  @Get(':provider/start')
  @Redirect()
  async start(
    @Param('provider', { schema: oauthProviderSchema }) provider: OAuthProvider,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RedirectTarget> {
    const { url, stateToken } = await this.oauthService.start(provider);
    oauthStateCookie.set(res, stateToken);
    res.set('Cache-Control', 'no-store');
    return { url };
  }

  @Get(':provider/callback')
  @Redirect()
  async callback(
    @Param('provider', { schema: oauthProviderSchema }) provider: OAuthProvider,
    @Query({ schema: oauthCallbackQuerySchema }) query: OAuthCallbackQuery,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RedirectTarget> {
    oauthStateCookie.clear(res);
    if ('error' in query) {
      return { url: this.oauthService.deniedUrl };
    }
    const stateToken = oauthStateCookie.read(req);
    const user = await this.oauthService.finish({ provider, query, stateToken });
    const session = await this.sessions.start(user.id);
    sendSession({ req, res, session });
    return { url: this.oauthService.landingUrl };
  }
}
