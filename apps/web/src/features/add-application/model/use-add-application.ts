import {
  type CapturePasteInput,
  type CapturePasteResponse,
  type CreateApplicationInput,
  type PossibleDuplicate,
} from '@jobflow/shared';
import { type MutationKey, useQueryClient } from '@tanstack/react-query';
import type { FieldValues } from 'react-hook-form';

import { addErrorToastOf, type AddLimit, applicationKeys } from '@/entities/application';
import {
  type ApplyFieldErrorsOptions,
  type GuardedSave,
  useGuardedSave,
  useSubmitKey,
} from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showToast } from '@/shared/ui/toast';

import { ADD_ENDPOINTS, type AddEndpoint, postAddition } from '../api/add-application';

export type AddedApplication = Readonly<{ possibleDuplicates: readonly PossibleDuplicate[] }>;

export type CapturedDraft = Pick<CapturePasteResponse, 'applicationId' | 'jobId'>;

export type AddSaveOptions<
  Values extends FieldValues,
  Result extends AddedApplication = AddedApplication,
> = Readonly<{
  form: Omit<ApplyFieldErrorsOptions<Values>, 'error'>;
  onAdded: (added: Result) => void;
}>;

type AddRoute<Result extends AddedApplication> = Readonly<{
  mutationKey: MutationKey;
  endpoint: AddEndpoint<Result>;
  toastDescription: string;
  limit: AddLimit;
}>;

const ADDED_TOAST_ID = 'application-added';

const PASTE_KEY = ['add-application', 'paste'] as const;

const MANUAL_KEY = ['add-application', 'manual'] as const;

const PASTE = {
  mutationKey: PASTE_KEY,
  endpoint: ADD_ENDPOINTS.paste,
  toastDescription: uk.add.paste.added,
  limit: 'parseLimit',
} as const;

const MANUAL = {
  mutationKey: MANUAL_KEY,
  endpoint: ADD_ENDPOINTS.manual,
  toastDescription: uk.add.manual.added,
  limit: 'requestLimit',
} as const;

function useAddSave<Body, Values extends FieldValues, Result extends AddedApplication>(
  route: AddRoute<Result>,
  { form, onAdded }: AddSaveOptions<Values, Result>,
): GuardedSave<Body> {
  const queryClient = useQueryClient();
  const submitKey = useSubmitKey();
  return useGuardedSave({
    mutationKey: route.mutationKey,
    request: (body: Body) =>
      postAddition({ endpoint: route.endpoint, body, idempotencyKey: submitKey.keyFor(body) }),
    form,
    errorToast: addErrorToastOf(route.limit),
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
  options: AddSaveOptions<Values, CapturePasteResponse>,
): GuardedSave<CapturePasteInput> {
  return useAddSave(PASTE, options);
}

export function useCreateApplication<Values extends FieldValues>(
  options: AddSaveOptions<Values>,
): GuardedSave<CreateApplicationInput> {
  return useAddSave(MANUAL, options);
}
