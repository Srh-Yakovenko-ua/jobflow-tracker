import type { MutationStatus } from '@tanstack/react-query';

import { uk } from '@/shared/i18n';

export type SaveStatusProps = Readonly<{ status: MutationStatus }>;

const STATUS_TEXT: Record<MutationStatus, string> = {
  idle: '',
  pending: uk.settings.saving,
  success: uk.settings.saved,
  error: '',
};

export function SaveStatus({ status }: SaveStatusProps) {
  return (
    <p role="status" className="text-[12.5px] leading-[1.4] font-medium text-ink-3">
      {STATUS_TEXT[status]}
    </p>
  );
}
