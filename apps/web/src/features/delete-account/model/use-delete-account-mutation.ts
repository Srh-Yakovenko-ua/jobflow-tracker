import { type DeleteAccountInput, deleteAccountInputSchema } from '@jobflow/shared';
import type { UseFormSetError } from 'react-hook-form';

import { useEndSession } from '@/entities/user';
import { type GuardedSave, useGuardedSave } from '@/shared/api';
import { uk } from '@/shared/i18n';

import { deleteAccount } from '../api/delete-account';

const COPY = uk.settings.account.deletion.dialog;

const ACCOUNT_FIELDS = deleteAccountInputSchema.keyof().options;

const DELETE_KEY = ['account-deletion'] as const;

export function useDeleteAccountMutation(
  setError: UseFormSetError<DeleteAccountInput>,
): GuardedSave<DeleteAccountInput> {
  const endSession = useEndSession();
  return useGuardedSave({
    mutationKey: DELETE_KEY,
    request: deleteAccount,
    form: { fields: ACCOUNT_FIELDS, setError, messages: { password: COPY.wrongPassword } },
    onSuccess: endSession,
    errorToast: () => COPY.failed,
  });
}
