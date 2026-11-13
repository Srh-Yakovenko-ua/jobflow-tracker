'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';
import { usePrefersReducedMotion } from '@/shared/lib/reduced-motion';
import { useDataTransition } from '@/shared/lib/use-data-transition';

const PERCENT = 100;

export type GrowBarProps = Readonly<{ share: number; className: string; children?: ReactNode }>;

export function GrowBar({ share, className, children }: GrowBarProps) {
  const reduced = usePrefersReducedMotion();
  const transition = useDataTransition();
  return (
    <motion.span
      aria-hidden
      className={cn('flex origin-left', className)}
      style={{ width: `${String(share * PERCENT)}%` }}
      initial={reduced ? false : { scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={transition}
    >
      {children}
    </motion.span>
  );
}
