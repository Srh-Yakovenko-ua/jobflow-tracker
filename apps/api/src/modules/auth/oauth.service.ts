import type { AuthUser, OAuthCodeQuery, OAuthProvider } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { errorFor } from '../../common/app-error.js';
import type { Env } from '../../config/env.js';
import { AuthService } from './auth.service.js';
import { OAuthClient } from './oauth-client.js';
import { OAuthStates } from './oauth-state.js';

export type OAuthRedirect = { url: string; stateToken: string };

export type OAuthFinish = {
  provider: OAuthProvider;
  query: OAuthCodeQuery;
  stateToken: string | undefined;
};

@Injectable()
export class OAuthService {
  readonly landingUrl: string;

  readonly deniedUrl: string;

  constructor(
    private readonly client: OAuthClient,
    private readonly states: OAuthStates,
    private readonly accounts: AuthService,
    config: ConfigService<Env, true>,
  ) {
    const webOrigin = config.get('WEB_ORIGIN', { infer: true });
    this.landingUrl = new URL('/board', webOrigin).href;
    this.deniedUrl = new URL('/login?oauth=denied', webOrigin).href;
  }

  async start(provider: OAuthProvider): Promise<OAuthRedirect> {
    const { url, ...pending } = await this.client.begin(provider);
    return { url: url.href, stateToken: await this.states.sign(pending) };
  }

  async finish({ provider, query, stateToken }: OAuthFinish): Promise<AuthUser> {
    const pending = await this.states.verify(stateToken);
    if (pending.provider !== provider || pending.state !== query.state) {
      throw errorFor(400, 'OAuth state does not match');
    }
    const profile = await this.client.profile({ ...pending, code: query.code });
    return this.accounts.signInWithOAuth({ ...profile, provider });
  }
}
