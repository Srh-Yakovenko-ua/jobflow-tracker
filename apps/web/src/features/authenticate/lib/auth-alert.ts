import { ApiError } from '@/shared/api';

import { credentialFieldOf } from '../model/auth-modes';

export type AuthAlert =
  | { kind: 'invalidCredentials' | 'unavailable' }
  | { kind: 'rateLimited'; deadline: number | undefined };

export type AuthAlertSource = { error: Error | null; submittedAt: number };

const SECOND_MS = 1000;

const UNAVAILABLE: AuthAlert = { kind: 'unavailable' };

function namesCredentialField(error: ApiError): boolean {
  return (error.body.errors ?? []).some(({ path }) => credentialFieldOf([path]) !== undefined);
}

function rateLimited(error: ApiError, submittedAt: number): AuthAlert {
  const seconds = error.retryAfterSeconds;
  return {
    kind: 'rateLimited',
    deadline: seconds === undefined ? undefined : submittedAt + seconds * SECOND_MS,
  };
}

function alertForStatus(error: ApiError, submittedAt: number): AuthAlert | undefined {
  if (error.status === 401) return { kind: 'invalidCredentials' };
  if (error.status === 429) return rateLimited(error, submittedAt);
  if (error.status === 409) return undefined;
  if (error.status === 422 && namesCredentialField(error)) return undefined;
  return UNAVAILABLE;
}

export function authAlertOf({ error, submittedAt }: AuthAlertSource): AuthAlert | undefined {
  if (error === null) return undefined;
  return error instanceof ApiError ? alertForStatus(error, submittedAt) : UNAVAILABLE;
}
