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

function writeThenToast(write: () => Promise<void>): void {
  void Promise.resolve()
    .then(write)
    .then(
      () => {
        showToast(OUTCOMES.copied, COPY_TOAST);
      },
      () => {
        showToast(OUTCOMES.refused, COPY_TOAST);
      },
    );
}

export function copyToClipboard(value: string): void {
  writeThenToast(() => navigator.clipboard.writeText(value));
}

export function copyImageToClipboard(blob: Blob): void {
  writeThenToast(() => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]));
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
