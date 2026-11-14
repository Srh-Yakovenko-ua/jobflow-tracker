'use client';

import { AnimatePresence } from 'motion/react';

import type { NotificationDay } from '@/entities/notification';
import { cn } from '@/shared/lib/cn';
import { Fade } from '@/shared/ui/fade';

import { NotificationRow, type NotificationRowContext } from './notification-row';

export type NotificationDaysProps = Readonly<{
  days: readonly NotificationDay[];
  context: NotificationRowContext;
  className?: string;
}>;

export function NotificationDays({ days, context, className }: NotificationDaysProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {days.map((day) => (
        <section key={day.key} aria-label={day.label} className="flex flex-col gap-0.5">
          <h3 className="px-2 pt-1 text-[10.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
            {day.label}
          </h3>
          <AnimatePresence mode="popLayout" initial={false}>
            {day.notifications.map((notification) => (
              <Fade key={notification.id} motion={{ layout: 'position' }}>
                <NotificationRow notification={notification} context={context} />
              </Fade>
            ))}
          </AnimatePresence>
        </section>
      ))}
    </div>
  );
}
