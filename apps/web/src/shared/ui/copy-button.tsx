'use client';

import { Copy } from 'lucide-react';

import { uk } from '@/shared/i18n';

import { IconAction } from './icon-action';
import { showToast, type ToastContent } from './toast';

export type CopyButtonProps = Readonly<{ value: string; label: string }>;

const COPY_TOAST = { id: 'copy-toast' } as const;

const OUTCOMES = {
  copied: { tone: 'success', title: uk.ui.copied },
  refused: { tone: 'error', title: uk.ui.copyFailed },
} as const satisfies Record<string, ToastContent>;

export function copyToClipboard(value: string): void {
  void Promise.resolve()
    .then(() => navigator.clipboard.writeText(value))
    .then(
      () => {
        showToast(OUTCOMES.copied, COPY_TOAST);
      },
      () => {
        showToast(OUTCOMES.refused, COPY_TOAST);
      },
    );
}

export function CopyButton({ value, label }: CopyButtonProps) {
  return (
    <IconAction
      label={label}
      icon={Copy}
      onClick={() => {
        copyToClipboard(value);
      }}
    />
  );
}
