import { type MutationKey, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FieldValues } from 'react-hook-form';

import { uk } from '@/shared/i18n';
import { type ErrorToastContent, showErrorToast } from '@/shared/ui/error-toast';

import { ApiError } from './api-error';
import { applyFieldErrors, type ApplyFieldErrorsOptions } from './field-errors';

type GuardedSaveOptions<Body, Values extends FieldValues, Result> = Readonly<{
  mutationKey: MutationKey;
  request: (body: Body) => Promise<Result>;
  form: Omit<ApplyFieldErrorsOptions<Values>, 'error'>;
  onSuccess: (result: Result) => unknown;
  errorToast?: (error: Error) => ErrorToastContent;
}>;

export type GuardedSave<Body> = Readonly<{
  isPending: boolean;
  isSuccess: boolean;
  save: (body: Body) => void;
}>;

export function useGuardedSave<Body, Values extends FieldValues, Result>({
  mutationKey,
  request,
  form,
  onSuccess,
  errorToast,
}: GuardedSaveOptions<Body, Values, Result>): GuardedSave<Body> {
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
      showErrorToast(errorToast?.(error) ?? uk.errors.saveFailed);
    },
  });
  return {
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    save: (body) => {
      if (queryClient.isMutating({ mutationKey }) > 0) return;
      mutation.mutate(body);
    },
  };
}
