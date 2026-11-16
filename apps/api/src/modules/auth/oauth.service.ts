import {
  AUTH_ROUTES,
  type AuthUser,
  type OAuthCodeQuery,
  type OAuthProvider,
  safeReturnTo,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppError, errorFor } from '../../common/app-error.js';
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

export type OAuthSignedIn = { user: AuthUser; landingUrl: string };

type LoginRedirect = { query: Record<string, string>; returnTo: string };

const OAUTH_RETURN_TO_MAX_LENGTH = 2048;

function signedClaimLength(value: string): number {
  return JSON.stringify(value).slice(1, -1).length;
}

function boundedReturnTo(next: string | undefined): string {
  const returnTo = safeReturnTo(next);
  return signedClaimLength(returnTo) > OAUTH_RETURN_TO_MAX_LENGTH ? AUTH_ROUTES.home : returnTo;
}

function homeOnRefusedState(error: unknown): string {
  if (error instanceof AppError && error.status === 400) {
    return AUTH_ROUTES.home;
  }
  throw error;
}

@Injectable()
export class OAuthService {
  private readonly webOrigin: string;

  constructor(
    private readonly client: OAuthClient,
    private readonly states: OAuthStates,
    private readonly accounts: AuthService,
    config: ConfigService<Env, true>,
  ) {
    this.webOrigin = config.get('WEB_ORIGIN', { infer: true });
  }

  providers(): OAuthProvider[] {
    return this.client.enabledProviders();
  }

  async start(provider: OAuthProvider, next?: string): Promise<OAuthRedirect> {
    const returnTo = boundedReturnTo(next);
    if (!this.client.enabledProviders().includes(provider)) {
      return { url: this.loginUrl({ query: { oauth: 'unavailable', provider }, returnTo }) };
    }
    const { url, ...pending } = await this.client.begin(provider);
    return { url: url.href, stateToken: await this.states.sign({ ...pending, returnTo }) };
  }

  async finish({ provider, query, stateToken }: OAuthFinish): Promise<OAuthSignedIn> {
    const { returnTo, ...pending } = await this.states.verify(stateToken);
    if (pending.provider !== provider || pending.state !== query.state) {
      throw errorFor(400, 'OAuth state does not match');
    }
    const profile = await this.client.profile({ ...pending, code: query.code });
    const user = await this.accounts.signInWithOAuth({ ...profile, provider });
    return { user, landingUrl: new URL(returnTo, this.webOrigin).href };
  }

  async declinedUrl(stateToken: string | undefined): Promise<string> {
    const returnTo = await this.states
      .verify(stateToken)
      .then((state) => state.returnTo, homeOnRefusedState);
    return this.loginUrl({ query: { oauth: 'denied' }, returnTo });
  }

  private loginUrl({ query, returnTo }: LoginRedirect): string {
    const url = new URL(AUTH_ROUTES.login, this.webOrigin);
    for (const [name, value] of Object.entries(query)) {
      url.searchParams.set(name, value);
    }
    if (returnTo !== AUTH_ROUTES.home) {
      url.searchParams.set(AUTH_ROUTES.returnParam, returnTo);
    }
    return url.href;
  }
}
