'use client';

import { AnimatePresence } from 'motion/react';

import type { SectionLoad } from '@/shared/lib/section-load';

import { LoadFailedAlert } from './banner';
import { Fade } from './fade';

export type FailedReadAlertProps = Readonly<{ load: SectionLoad; className?: string }>;

export function FailedReadAlert({ load, className }: FailedReadAlertProps) {
  return (
    <AnimatePresence initial={false}>
      {load.failed && (
        <Fade key="failed-read">
          <LoadFailedAlert className={className} load={load} />
        </Fade>
      )}
    </AnimatePresence>
  );
}
