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
import Link from 'next/link';

import { notificationTargetOf } from '@/entities/notification';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { notificationCopyOf } from '../model/notification-copy';
import { useMarkReadMutation } from '../model/use-mark-read';

const ICONS: Record<Notification['type'], LucideIcon> = {
  silence: CircleDashed,
  interview_soon: PhoneCall,
  ai_done: Sparkles,
  ai_failed: CircleAlert,
  insight_unlocked: TrendingUp,
};

const FADE = 'transition-[background-color,color,opacity] duration-(--duration-base) ease-standard';

export type NotificationRowContext = Readonly<{ timeZone: string; onFollow?: () => void }>;

export type NotificationRowProps = Readonly<{
  notification: Notification;
  context: NotificationRowContext;
}>;

function useFollow({ notification, context }: NotificationRowProps) {
  const markRead = useMarkReadMutation();
  return () => {
    if (notification.readAt === null) markRead.mutate({ ids: [notification.id] });
    context.onFollow?.();
  };
}

export function NotificationRow({ notification, context }: NotificationRowProps) {
  const unread = notification.readAt === null;
  const copy = notificationCopyOf(notification, context.timeZone);
  const target = notificationTargetOf(notification);
  const follow = useFollow({ notification, context });
  const Icon = ICONS[notification.type];
  return (
    <div
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
        {target !== null && (
          <Link
            href={target}
            onClick={follow}
            className="touch-target mt-0.5 w-fit rounded-sm text-[11.5px] font-semibold text-link transition-colors duration-(--duration-instant) ease-standard hover:text-accent-press active:text-accent-press"
          >
            {copy.action}
          </Link>
        )}
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
