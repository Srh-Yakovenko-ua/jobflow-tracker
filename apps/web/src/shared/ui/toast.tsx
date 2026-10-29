'use client';

import { Check, CircleAlert, Clock, type LucideIcon } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';

import { cn } from '@/shared/lib/cn';

export type ToastTone = 'success' | 'error' | 'info' | 'undo';

export type ToastAction = { label: string; onAction: () => void };

export type ToastContent = {
  tone: ToastTone;
  title: string;
  description?: string;
  action?: ToastAction;
};

export type ToastOptions = { id?: string; duration?: number };

type ToastSurface = { card: string; description: string; action: string };

type ToastMark = { Icon: LucideIcon; className: string };

type ToastLook = { surface: ToastSurface; mark?: ToastMark };

const PLAIN: ToastSurface = {
  card: 'bg-surface text-ink inset-ring inset-ring-line-soft',
  description: 'text-ink-2',
  action: '-my-2.5 min-h-11 px-1.75 text-[13px] text-link hover:bg-accent-tint',
};

const INVERSE: ToastSurface = {
  card: 'bg-ink text-paper',
  description: 'text-paper/75',
  action:
    'touch-target bg-paper/12 px-2.5 py-1.5 text-[12.5px] text-paper hover:bg-paper/18 active:bg-paper/24',
};

const TONES: Record<ToastTone, ToastLook> = {
  success: { surface: PLAIN, mark: { Icon: Check, className: 'bg-offer/12 text-offer' } },
  error: { surface: PLAIN, mark: { Icon: CircleAlert, className: 'bg-danger/8 text-danger' } },
  info: { surface: PLAIN, mark: { Icon: Clock, className: 'bg-accent-tint text-accent-press' } },
  undo: { surface: INVERSE },
};

function ToneMark({ mark }: Readonly<{ mark: ToastMark }>) {
  const { Icon } = mark;
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 flex-none items-center justify-center rounded-[10px]',
        mark.className,
      )}
    >
      <Icon size={14} />
    </span>
  );
}

export type ToastCardProps = Readonly<{ content: ToastContent; onDismiss?: () => void }>;

export function ToastCard({ content, onDismiss }: ToastCardProps) {
  const actionRanRef = useRef(false);
  const { surface, mark } = TONES[content.tone];
  const runAction = (action: ToastAction) => {
    if (actionRanRef.current) return;
    actionRanRef.current = onDismiss !== undefined;
    action.onAction();
    onDismiss?.();
  };
  return (
    <div
      className={cn(
        'flex w-(--width) max-w-full items-start gap-3 rounded-2xl px-4 py-3.5 font-ui shadow-e3',
        surface.card,
      )}
    >
      {mark && <ToneMark mark={mark} />}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-px">
        <p className="text-[14px] leading-[1.35] font-semibold">{content.title}</p>
        {content.description && (
          <p className={cn('text-[12.5px] leading-[1.5]', surface.description)}>
            {content.description}
          </p>
        )}
      </div>
      {content.action && (
        <button
          type="button"
          onClick={() => {
            if (content.action) runAction(content.action);
          }}
          className={cn(
            'flex-none self-center rounded-sm font-semibold transition-colors duration-(--duration-instant) ease-standard',
            surface.action,
          )}
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
