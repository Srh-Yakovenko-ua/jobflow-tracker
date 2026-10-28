import { authUserSchema, type OAuthProvider, registerInputSchema } from '@jobflow/shared';
import {
  type Configuration,
  fetchProtectedResource,
  type ServerMetadata,
  type TokenEndpointResponse,
  type TokenEndpointResponseHelpers,
} from 'openid-client';
import { z } from 'zod';

import { type AppError, errorFor } from '../../common/app-error.js';

export type OAuthProfile = {
  providerUserId: string;
  email: string;
  displayName?: string | undefined;
};

export type ProfileSource = {
  config: Configuration;
  tokens: TokenEndpointResponse & TokenEndpointResponseHelpers;
};

export type ProviderSpec = {
  label: string;
  scope: string;
  server: ServerMetadata;
  readProfile: (source: ProfileSource) => OAuthProfile | Promise<OAuthProfile>;
};

type ProfileFields = { providerUserId: string; email: string | undefined; name: unknown };

const GITHUB_API = 'https://api.github.com';

const GITHUB_MEDIA_TYPE = 'application/vnd.github+json';

const googleClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
  email_verified: z.boolean().optional(),
  name: z.unknown(),
});

const githubUserSchema = z.object({
  id: z.number().int(),
  login: z.string(),
  name: z.string().nullable(),
});

const githubEmailsSchema = z.array(
  z.object({ email: z.string(), primary: z.boolean(), verified: z.boolean() }),
);

export const providerUnreachable = (label: string): AppError =>
  errorFor(503, `${label} is not reachable`);

function profileOf({ providerUserId, email, name }: ProfileFields): OAuthProfile {
  const verifiedEmail = authUserSchema.shape.email.safeParse(email);
  if (!verifiedEmail.success) {
    throw errorFor(400, 'The provider account has no verified email');
  }
  const displayName = registerInputSchema.shape.displayName.safeParse(name);
  return {
    providerUserId,
    email: verifiedEmail.data,
    displayName: displayName.success ? displayName.data : undefined,
  };
}

function readGoogleProfile({ tokens }: ProfileSource): OAuthProfile {
  const claims = googleClaimsSchema.parse(tokens.claims());
  return profileOf({
    providerUserId: claims.sub,
    email: claims.email_verified === true ? claims.email : undefined,
    name: claims.name,
  });
}

async function fetchGitHub({ config, tokens }: ProfileSource, path: string): Promise<unknown> {
  const response = await fetchProtectedResource(
    config,
    tokens.access_token,
    new URL(path, GITHUB_API),
    'GET',
    undefined,
    new Headers({ accept: GITHUB_MEDIA_TYPE }),
  );
  if (!response.ok) {
    throw providerUnreachable('GitHub');
  }
  return response.json();
}

async function readGitHubProfile(source: ProfileSource): Promise<OAuthProfile> {
  const user = githubUserSchema.parse(await fetchGitHub(source, '/user'));
  const emails = githubEmailsSchema.parse(await fetchGitHub(source, '/user/emails'));
  return profileOf({
    providerUserId: String(user.id),
    email: emails.find(({ primary, verified }) => primary && verified)?.email,
    name: user.name ?? user.login,
  });
}

export const OAUTH_PROVIDER_SPECS: Record<OAuthProvider, ProviderSpec> = {
  google: {
    label: 'Google',
    scope: 'openid email profile',
    server: {
      issuer: 'https://accounts.google.com',
      authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_endpoint: 'https://oauth2.googleapis.com/token',
      code_challenge_methods_supported: ['S256'],
    },
    readProfile: readGoogleProfile,
  },
  github: {
    label: 'GitHub',
    scope: 'user:email',
    server: {
      issuer: 'https://github.com',
      authorization_endpoint: 'https://github.com/login/oauth/authorize',
      token_endpoint: 'https://github.com/login/oauth/access_token',
      code_challenge_methods_supported: ['S256'],
    },
    readProfile: readGitHubProfile,
  },
};
