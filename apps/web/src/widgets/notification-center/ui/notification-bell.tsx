'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useState } from 'react';

import { meQueryOptions } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { COUNT_PILL } from '@/shared/ui/count-pill';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

import { useUnreadSync } from '../model/use-unread-sync';
import { BellPanel } from './bell-panel';

const COPY = uk.notifications;

const BADGE_CAP = 99;

const BELL =
  'touch-target flex size-8 flex-none items-center justify-center rounded-[9px] bg-surface text-ink-2 inset-ring inset-ring-line-soft transition-colors duration-(--duration-instant) ease-standard hover:bg-surface-3 hover:text-ink active:bg-surface-3 data-[state=open]:bg-accent-tint data-[state=open]:text-accent-press data-[state=open]:inset-ring-accent/40';

function badgeOf(unread: number): string {
  return unread > BADGE_CAP ? `${String(BADGE_CAP)}+` : String(unread);
}

function useUnreadCount(): number {
  return useQuery({ ...meQueryOptions(), select: (me) => me.unreadNotifications }).data ?? 0;
}

export function NotificationBell() {
  useUnreadSync();
  const unread = useUnreadCount();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={COPY.bell(unread)} className={BELL}>
          <Bell aria-hidden size={16} />
          {unread > 0 && (
            <span
              key={unread}
              aria-hidden
              className={cn(
                COUNT_PILL,
                'pointer-events-none absolute -top-0.75 -right-0.75 animate-fade-in shadow-[0_0_0_2px_var(--paper)]',
              )}
            >
              {badgeOf(unread)}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={COPY.title}
        align="end"
        className="flex w-73 max-w-[calc(100vw-16px)] origin-(--radix-popover-content-transform-origin) flex-col gap-0.5 rounded-[14px] p-1.5"
      >
        <BellPanel
          unread={unread}
          onFollow={() => {
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
