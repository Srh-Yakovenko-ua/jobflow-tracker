import { type ChangePasswordInput, changePasswordInputSchema } from '@jobflow/shared';
import { useMutation } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';

import { ApiError, applyFieldErrors } from '@/shared/api';
import { uk } from '@/shared/i18n';

import { changePassword } from '../api/change-password';

export type PasswordForm = Pick<UseFormReturn<ChangePasswordInput>, 'setError' | 'reset'>;

const PASSWORD_FIELDS = changePasswordInputSchema.keyof().options;

const COPY = uk.settings.password;

export function useChangePasswordMutation({ setError, reset }: PasswordForm) {
  return useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      reset();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) {
        applyFieldErrors({
          error,
          fields: PASSWORD_FIELDS,
          setError,
          messages: { currentPassword: COPY.wrongCurrent },
        });
        return;
      }
      setError('root.server', { type: 'server', message: COPY.failed.title });
    },
  });
}
