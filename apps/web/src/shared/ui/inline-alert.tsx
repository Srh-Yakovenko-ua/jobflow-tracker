'use client';

import { AnimatePresence } from 'motion/react';

import { cn } from '@/shared/lib/cn';

import { FAILED_MARK } from './async-state';
import { Fade } from './fade';

export type InlineAlertProps = Readonly<{ message: string | null; className?: string }>;

export function InlineAlert({ message, className }: InlineAlertProps) {
  return (
    <AnimatePresence initial={false}>
      {message !== null && (
        <Fade key={message} className={cn('min-w-0', className)}>
          <p
            role="alert"
            className="flex items-start gap-2.25 text-[12.5px] leading-normal text-danger"
          >
            <span className="mt-0.5">{FAILED_MARK}</span>
            <span>{message}</span>
          </p>
        </Fade>
      )}
    </AnimatePresence>
  );
}
