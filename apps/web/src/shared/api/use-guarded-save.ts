import { type MutationKey, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FieldValues } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

import { ApiError } from './api-error';
import { applyFieldErrors, type ApplyFieldErrorsOptions } from './field-errors';

export type GuardedSaveOptions<Body, Values extends FieldValues> = Readonly<{
  mutationKey: MutationKey;
  request: (body: Body) => Promise<unknown>;
  form: Omit<ApplyFieldErrorsOptions<Values>, 'error'>;
  onSuccess: () => unknown;
}>;

export type GuardedSave<Body> = Readonly<{ isPending: boolean; save: (body: Body) => void }>;

export function useGuardedSave<Body, Values extends FieldValues>({
  mutationKey,
  request,
  form,
  onSuccess,
}: GuardedSaveOptions<Body, Values>): GuardedSave<Body> {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey,
    mutationFn: request,
    onSuccess,
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) {
        applyFieldErrors({ error, ...form });
        return;
      }
      showErrorToast(uk.errors.saveFailed);
    },
  });
  return {
    isPending: mutation.isPending,
    save: (body) => {
      if (queryClient.isMutating({ mutationKey }) > 0) return;
      mutation.mutate(body);
    },
  };
}
