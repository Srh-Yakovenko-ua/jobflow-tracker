'use client';

import type { Notification } from '@jobflow/shared';
import {
  CircleAlert,
  CircleDashed,
  type LucideIcon,
  PhoneCall,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { type RefObject, useRef } from 'react';

import { notificationTargetOf } from '@/entities/notification';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Fade } from '@/shared/ui/fade';

import { notificationCopyOf } from '../model/notification-copy';
import { useMarkReadMutation } from '../model/use-mark-read';

const ICONS: Record<Notification['type'], LucideIcon> = {
  silence: CircleDashed,
  interview_soon: PhoneCall,
  ai_done: Sparkles,
  ai_failed: CircleAlert,
  insight_unlocked: TrendingUp,
  monthly_summary_ready: Sparkles,
};

const FADE = 'transition-[background-color,color,opacity] duration-(--duration-base) ease-standard';

export type NotificationRowContext = Readonly<{ timeZone: string; onFollow?: () => void }>;

export type NotificationRowProps = Readonly<{
  notification: Notification;
  context: NotificationRowContext;
}>;

const ACTION =
  'touch-target mt-0.5 w-fit rounded-sm text-[11.5px] font-semibold text-link transition-colors duration-(--duration-instant) ease-standard hover:text-accent-press active:text-accent-press disabled:opacity-60';

type RowActionProps = NotificationRowProps &
  Readonly<{ label: string; rowRef: RefObject<HTMLDivElement | null> }>;

function useRowActions({ notification, context, rowRef }: Omit<RowActionProps, 'label'>) {
  const markRead = useMarkReadMutation();
  const ids = [notification.id];
  const read = () => {
    markRead.mutate({ ids }, { onSuccess: () => rowRef.current?.focus() });
  };
  const follow = () => {
    if (notification.readAt === null) markRead.mutate({ ids });
    context.onFollow?.();
  };
  return { read, follow, reading: markRead.isPending };
}

function RowAction({ label, ...row }: RowActionProps) {
  const { notification } = row;
  const target = notificationTargetOf(notification);
  const actions = useRowActions(row);
  if (target !== null) {
    return (
      <Link href={target} onClick={actions.follow} className={ACTION}>
        {label}
      </Link>
    );
  }
  return (
    <AnimatePresence initial={false}>
      {notification.readAt === null && (
        <Fade key="mark-read">
          <button
            type="button"
            disabled={actions.reading}
            onClick={actions.read}
            className={ACTION}
          >
            {uk.notifications.markRead}
          </button>
        </Fade>
      )}
    </AnimatePresence>
  );
}

export function NotificationRow({ notification, context }: NotificationRowProps) {
  const unread = notification.readAt === null;
  const copy = notificationCopyOf(notification, context.timeZone);
  const Icon = ICONS[notification.type];
  const rowRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={rowRef}
      tabIndex={-1}
      className={cn(
        'flex items-start gap-2.5 rounded-[9px] p-2.25 hover:bg-surface-3 active:bg-surface-3',
        FADE,
        unread && 'bg-accent-tint/50',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-6.5 flex-none items-center justify-center rounded-[8px]',
          FADE,
          unread ? 'bg-accent-tint text-accent-press' : 'bg-surface-3 text-ink-3',
        )}
      >
        <Icon size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-[12.5px] leading-[1.35] font-semibold wrap-break-word text-ink">
          {copy.title}
          {unread && <span className="sr-only">{`, ${uk.notifications.unread}`}</span>}
        </p>
        <p className="text-[11.5px] leading-[1.45] wrap-break-word text-ink-2">{copy.text}</p>
        <RowAction
          notification={notification}
          context={context}
          label={copy.action}
          rowRef={rowRef}
        />
      </div>
      <span
        aria-hidden
        className={cn(
          'mt-1.25 size-1.75 flex-none rounded-pill bg-accent',
          FADE,
          !unread && 'opacity-0',
        )}
      />
    </div>
  );
}
