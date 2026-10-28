import { OAUTH_PROVIDERS, type OAuthProvider } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  authorizationCodeGrant,
  AuthorizationResponseError,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  ClientError,
  Configuration,
  randomPKCECodeVerifier,
  randomState,
  ResponseBodyError,
} from 'openid-client';

import { API_PREFIX } from '../../common/api-prefix.middleware.js';
import { errorFor, notFound } from '../../common/app-error.js';
import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import { type Env, OAUTH_CREDENTIAL_KEYS } from '../../config/env.js';
import { OAUTH_PROVIDER_SPECS, type OAuthProfile, providerUnreachable } from './oauth-profiles.js';
import type { OAuthState } from './oauth-state.js';

export type OAuthStart = OAuthState & { url: URL };

export type OAuthCallback = OAuthState & { code: string };

type ProviderConfig = { provider: OAuthProvider; config: ConfigService<Env, true> };

type ProviderFailure = { error: unknown; label: string };

const UNREACHABLE_CODES: ReadonlySet<string | undefined> = new Set([
  'OAUTH_TIMEOUT',
  'OAUTH_ABORT',
]);

function isUnreachable(error: unknown): boolean {
  if (error instanceof ClientError) {
    return UNREACHABLE_CODES.has(error.code);
  }
  return error instanceof TypeError && !('code' in error);
}

function isRefusal(error: unknown): boolean {
  return (
    error instanceof ClientError ||
    error instanceof ResponseBodyError ||
    error instanceof AuthorizationResponseError
  );
}

function toProviderError({ error, label }: ProviderFailure): unknown {
  if (isUnreachable(error)) {
    return providerUnreachable(label);
  }
  return isRefusal(error) ? errorFor(400, 'The provider refused the sign-in') : error;
}

function configurationFor({ provider, config }: ProviderConfig): Configuration[] {
  const keys = OAUTH_CREDENTIAL_KEYS[provider];
  const clientId = config.get(keys.clientId, { infer: true });
  const clientSecret = config.get(keys.clientSecret, { infer: true });
  if (!clientId || !clientSecret) {
    return [];
  }
  const configuration = new Configuration(
    OAUTH_PROVIDER_SPECS[provider].server,
    clientId,
    clientSecret,
  );
  configuration.timeout = DEPENDENCY_LIMITS.providerTimeoutMs / 1000;
  return [configuration];
}

@Injectable()
export class OAuthClient {
  private readonly configurations: Partial<Record<OAuthProvider, Configuration>>;

  private readonly apiUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.apiUrl = config.get('API_URL', { infer: true });
    this.configurations = Object.fromEntries(
      OAUTH_PROVIDERS.flatMap((provider) =>
        configurationFor({ provider, config }).map((configuration) => [provider, configuration]),
      ),
    );
  }

  async begin(provider: OAuthProvider): Promise<OAuthStart> {
    const configuration = this.configurationOf(provider);
    const state = randomState();
    const codeVerifier = randomPKCECodeVerifier();
    const url = buildAuthorizationUrl(configuration, {
      redirect_uri: this.redirectUri(provider),
      scope: OAUTH_PROVIDER_SPECS[provider].scope,
      code_challenge: await calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
    });
    return { provider, state, codeVerifier, url };
  }

  async profile({ provider, code, state, codeVerifier }: OAuthCallback): Promise<OAuthProfile> {
    const configuration = this.configurationOf(provider);
    const spec = OAUTH_PROVIDER_SPECS[provider];
    const currentUrl = new URL(this.redirectUri(provider));
    currentUrl.searchParams.set('code', code);
    currentUrl.searchParams.set('state', state);
    try {
      const tokens = await authorizationCodeGrant(configuration, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState: state,
      });
      return await spec.readProfile({ config: configuration, tokens });
    } catch (error) {
      throw toProviderError({ error, label: spec.label });
    }
  }

  private configurationOf(provider: OAuthProvider): Configuration {
    const configuration = this.configurations[provider];
    if (configuration === undefined) {
      throw notFound('OAuth provider is not configured');
    }
    return configuration;
  }

  private redirectUri(provider: OAuthProvider): string {
    return `${this.apiUrl}/${API_PREFIX}/auth/oauth/${provider}/callback`;
  }
}
