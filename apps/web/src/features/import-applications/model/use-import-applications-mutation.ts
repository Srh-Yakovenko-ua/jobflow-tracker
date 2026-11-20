'use client';

import type { ImportApplicationsInput, ImportApplicationsResponse } from '@jobflow/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { addErrorToastOf, applicationKeys } from '@/entities/application';
import { useSubmitKey } from '@/shared/api';
import { showErrorToast } from '@/shared/ui/error-toast';

import { importApplications } from '../api/import-applications';

export type ImportApplications = Readonly<{
  isPending: boolean;
  submit: (
    body: ImportApplicationsInput,
    onImported: (response: ImportApplicationsResponse) => void,
  ) => void;
}>;

const importErrorOf = addErrorToastOf('requestLimit');

export function useImportApplicationsMutation(): ImportApplications {
  const queryClient = useQueryClient();
  const submitKey = useSubmitKey();
  const mutation = useMutation({
    mutationFn: (body: ImportApplicationsInput) =>
      importApplications({ body, idempotencyKey: submitKey.keyFor(body) }),
    onSuccess: () => {
      submitKey.reset();
      void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
    },
    onError: (error) => {
      showErrorToast(importErrorOf(error));
    },
  });
  return {
    isPending: mutation.isPending,
    submit: (body, onImported) => {
      mutation.mutate(body, { onSuccess: onImported });
    },
  };
}
