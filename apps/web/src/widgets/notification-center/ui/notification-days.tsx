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
  headingLevel: 2 | 3;
}>;

const HEADINGS = { 2: 'h2', 3: 'h3' } as const;

export function NotificationDays({
  days,
  context,
  className,
  headingLevel,
}: NotificationDaysProps) {
  const Heading = HEADINGS[headingLevel];
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {days.map((day) => (
        <section key={day.key} aria-label={day.label} className="flex flex-col gap-0.5">
          <Heading className="px-2 pt-1 text-[10.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
            {day.label}
          </Heading>
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
