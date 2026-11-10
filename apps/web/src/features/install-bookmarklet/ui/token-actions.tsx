'use client';

import { uk } from '@/shared/i18n';
import { type ConfirmAction, ConfirmDialog } from '@/shared/ui/confirm-dialog';

const COPY = uk.bookmarklet;

const REGENERATE = { label: COPY.regenerate.action, variant: 'secondary' } as const;

const REVOKE = { label: COPY.revoke.action, variant: 'danger' } as const;

export type TokenActionsProps = Readonly<{ regenerate: ConfirmAction; revoke: ConfirmAction }>;

export function TokenActions({ regenerate, revoke }: TokenActionsProps) {
  return (
    <div className="flex flex-wrap gap-2.5">
      <ConfirmDialog trigger={REGENERATE} copy={COPY.regenerate.dialog} action={regenerate} />
      <ConfirmDialog trigger={REVOKE} copy={COPY.revoke.dialog} action={revoke} />
    </div>
  );
}
