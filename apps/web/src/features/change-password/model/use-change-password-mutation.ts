import { type ChangePasswordInput, changePasswordInputSchema } from '@jobflow/shared';
import type { UseFormReturn } from 'react-hook-form';

import { type GuardedSave, useGuardedSave } from '@/shared/api';
import { uk } from '@/shared/i18n';

import { changePassword } from '../api/change-password';

export type PasswordForm = Pick<UseFormReturn<ChangePasswordInput>, 'setError' | 'reset'>;

const PASSWORD_FIELDS = changePasswordInputSchema.keyof().options;

const COPY = uk.settings.password;

const CHANGE_KEY = ['password-change'] as const;

export function useChangePasswordMutation({
  setError,
  reset,
}: PasswordForm): GuardedSave<ChangePasswordInput> {
  return useGuardedSave({
    mutationKey: CHANGE_KEY,
    request: changePassword,
    form: { fields: PASSWORD_FIELDS, setError, messages: { currentPassword: COPY.wrongCurrent } },
    onSuccess: () => {
      reset();
    },
  });
}
