'use client';

import { Check, CircleAlert, Clock } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';

import { cn } from '@/shared/lib/cn';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastAction = { label: string; onAction: () => void };

export type ToastContent = {
  tone: ToastTone;
  title: string;
  description?: string;
  action?: ToastAction;
};

export type ToastOptions = { id?: string; duration?: number };

const TONES = {
  success: { Icon: Check, mark: 'bg-offer/12 text-offer' },
  error: { Icon: CircleAlert, mark: 'bg-danger/8 text-danger' },
  info: { Icon: Clock, mark: 'bg-accent-tint text-accent-press' },
} as const;

export type ToastCardProps = Readonly<{ content: ToastContent; onDismiss?: () => void }>;

export function ToastCard({ content, onDismiss }: ToastCardProps) {
  const actionRanRef = useRef(false);
  const { Icon, mark } = TONES[content.tone];
  const runAction = (action: ToastAction) => {
    if (actionRanRef.current) return;
    actionRanRef.current = true;
    action.onAction();
    onDismiss?.();
  };
  return (
    <div className="flex w-(--width) max-w-full items-start gap-3 rounded-2xl bg-surface px-4 py-3.5 font-ui text-ink shadow-e3 inset-ring inset-ring-line-soft">
      <span
        aria-hidden
        className={cn('flex size-8 flex-none items-center justify-center rounded-[10px]', mark)}
      >
        <Icon />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-px">
        <p className="text-[14px] leading-[1.35] font-semibold">{content.title}</p>
        {content.description && (
          <p className="text-[12.5px] leading-[1.5] text-ink-2">{content.description}</p>
        )}
      </div>
      {content.action && (
        <button
          type="button"
          onClick={() => {
            if (content.action) runAction(content.action);
          }}
          className="-my-2.5 min-h-11 flex-none self-center rounded-sm px-1.75 text-[13px] font-semibold text-accent-press transition-colors duration-(--duration-instant) ease-standard hover:bg-accent-tint"
        >
          {content.action.label}
        </button>
      )}
    </div>
  );
}

export function showToast(content: ToastContent, options: ToastOptions = {}): void {
  toast.custom(
    (toastId) => (
      <ToastCard
        content={content}
        onDismiss={() => {
          toast.dismiss(toastId);
        }}
      />
    ),
    options,
  );
}
