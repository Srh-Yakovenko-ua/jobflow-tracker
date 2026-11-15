'use client';

import type { ExportAccepted, ExportFormat } from '@jobflow/shared';
import { useMutation } from '@tanstack/react-query';

import { useSubmitKey } from '@/shared/api';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

import { requestExport } from '../api/export-data';

export type RequestExport = Readonly<{
  isPending: boolean;
  request: (format: ExportFormat, onAccepted: (accepted: ExportAccepted) => void) => void;
}>;

export function useRequestExportMutation(): RequestExport {
  const submitKey = useSubmitKey();
  const mutation = useMutation({
    mutationFn: (format: ExportFormat) => {
      const body = { format };
      return requestExport({ body, idempotencyKey: submitKey.keyFor(body) });
    },
    onSuccess: () => {
      submitKey.reset();
    },
    onError: () => {
      showErrorToast(uk.settings.account.export.failed);
    },
  });
  return {
    isPending: mutation.isPending,
    request: (format, onAccepted) => {
      mutation.mutate(format, { onSuccess: onAccepted });
    },
  };
}
