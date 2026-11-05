import type { AuthUser, OAuthCodeQuery, OAuthProvider } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { errorFor } from '../../common/app-error.js';
import type { Env } from '../../config/env.js';
import { AuthService } from './auth.service.js';
import { OAuthClient } from './oauth-client.js';
import { OAuthStates } from './oauth-state.js';

export type OAuthRedirect = { url: string; stateToken?: string };

export type OAuthFinish = {
  provider: OAuthProvider;
  query: OAuthCodeQuery;
  stateToken: string | undefined;
};

@Injectable()
export class OAuthService {
  readonly landingUrl: string;

  readonly deniedUrl: string;

  private readonly webOrigin: string;

  constructor(
    private readonly client: OAuthClient,
    private readonly states: OAuthStates,
    private readonly accounts: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
    this.landingUrl = new URL('/board', this.webOrigin).href;
    this.deniedUrl = new URL('/login?oauth=denied', this.webOrigin).href;
  }

  providers(): OAuthProvider[] {
    return this.client.enabledProviders();
  }

  async start(provider: OAuthProvider): Promise<OAuthRedirect> {
    if (!this.client.enabledProviders().includes(provider)) {
      return { url: this.unavailableUrl(provider) };
    }
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

  private unavailableUrl(provider: OAuthProvider): string {
    const url = new URL('/login', this.webOrigin);
    url.searchParams.set('oauth', 'unavailable');
    url.searchParams.set('provider', provider);
    return url.href;
  }
}
