'use client';

import { motion } from 'motion/react';

export type ActiveIndicatorProps = Readonly<{ group: string }>;

export function ActiveIndicator({ group }: ActiveIndicatorProps) {
  return (
    <motion.span
      aria-hidden
      data-slot="active-indicator"
      layoutId={group}
      className="absolute inset-0 -z-10 rounded-[inherit] bg-surface shadow-e1"
    />
  );
}
