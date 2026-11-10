import {
  type CapturePasteInput,
  capturePasteResponseSchema,
  type CreateApplicationInput,
  createApplicationResponseSchema,
  type PossibleDuplicate,
} from '@jobflow/shared';
import { type MutationKey, useQueryClient } from '@tanstack/react-query';
import type { FieldValues } from 'react-hook-form';
import type { z } from 'zod';

import { applicationKeys } from '@/entities/application';
import {
  apiClient,
  type ApplyFieldErrorsOptions,
  type GuardedSave,
  useGuardedSave,
  useSubmitKey,
} from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showToast } from '@/shared/ui/toast';

import { addErrorToastOf } from './add-error-toast';

export type AddedApplication = Readonly<{ possibleDuplicates: readonly PossibleDuplicate[] }>;

export type AddSaveOptions<Values extends FieldValues> = Readonly<{
  form: Omit<ApplyFieldErrorsOptions<Values>, 'error'>;
  onAdded: (added: AddedApplication) => void;
}>;

type AddRoute<Result extends AddedApplication> = Readonly<{
  mutationKey: MutationKey;
  path: string;
  schema: z.ZodType<Result>;
  toastDescription: string;
}>;

const ADDED_TOAST_ID = 'application-added';

const PASTE_KEY = ['add-application', 'paste'] as const;

const MANUAL_KEY = ['add-application', 'manual'] as const;

const PASTE = {
  mutationKey: PASTE_KEY,
  path: '/capture/paste',
  schema: capturePasteResponseSchema,
  toastDescription: uk.add.paste.added,
} as const;

const MANUAL = {
  mutationKey: MANUAL_KEY,
  path: '/applications',
  schema: createApplicationResponseSchema,
  toastDescription: uk.add.manual.added,
} as const;

function useAddSave<Body, Values extends FieldValues, Result extends AddedApplication>(
  route: AddRoute<Result>,
  { form, onAdded }: AddSaveOptions<Values>,
): GuardedSave<Body> {
  const queryClient = useQueryClient();
  const submitKey = useSubmitKey();
  return useGuardedSave({
    mutationKey: route.mutationKey,
    request: (body: Body) =>
      apiClient.request({
        path: route.path,
        method: 'POST',
        body,
        schema: route.schema,
        idempotencyKey: submitKey.keyFor(body),
      }),
    form,
    errorToast: addErrorToastOf,
    onSuccess: (added) => {
      submitKey.reset();
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      showToast(
        { tone: 'success', title: uk.add.added.toast, description: route.toastDescription },
        { id: ADDED_TOAST_ID },
      );
      onAdded(added);
    },
  });
}

export function usePasteApplication<Values extends FieldValues>(
  options: AddSaveOptions<Values>,
): GuardedSave<CapturePasteInput> {
  return useAddSave(PASTE, options);
}

export function useCreateApplication<Values extends FieldValues>(
  options: AddSaveOptions<Values>,
): GuardedSave<CreateApplicationInput> {
  return useAddSave(MANUAL, options);
}
