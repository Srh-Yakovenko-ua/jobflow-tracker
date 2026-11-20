import { type LoginInput, withPageHash } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { UseFormSetError } from 'react-hook-form';

import { ApiError, applyFieldErrors, HTTP_STATUS, setAccessToken } from '@/shared/api';
import { uk } from '@/shared/i18n';

import { authenticate } from '../api/authenticate';
import { AUTH_MODES, type AuthMode, type AuthModeSpec, CREDENTIAL_FIELDS } from './auth-modes';

export type UseAuthenticateMutationOptions = {
  mode: AuthMode;
  setError: UseFormSetError<LoginInput>;
  returnTo: string;
};

type FieldErrorTarget = { spec: AuthModeSpec; setError: UseFormSetError<LoginInput> };

function markFields(error: Error, { spec, setError }: FieldErrorTarget): void {
  if (!(error instanceof ApiError)) return;
  if (error.status === HTTP_STATUS.conflict) {
    setError('email', { type: 'server', message: uk.auth.email.taken }, { shouldFocus: true });
  }
  if (error.status === HTTP_STATUS.unprocessable) {
    applyFieldErrors({ error, fields: CREDENTIAL_FIELDS, setError, messages: spec.copy.fields });
  }
}

export function useAuthenticateMutation({
  mode,
  setError,
  returnTo,
}: UseAuthenticateMutationOptions) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const spec = AUTH_MODES[mode];
  return useMutation({
    mutationFn: (credentials: LoginInput) => authenticate({ path: spec.path, credentials }),
    onSuccess: (response) => {
      setAccessToken(response.accessToken);
      queryClient.clear();
      router.replace(withPageHash(returnTo, window.location.hash));
    },
    onError: (error) => {
      markFields(error, { spec, setError });
    },
  });
}
