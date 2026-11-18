import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import { BOARD_FRAME } from './column-frame';

export type BoardFrameProps = Readonly<{ children: ReactNode; busy?: boolean }>;

export function BoardFrame({ children, busy }: BoardFrameProps) {
  return (
    <motion.div
      layoutScroll
      aria-busy={busy}
      className={cn(BOARD_FRAME.width, 'overflow-x-auto p-1')}
    >
      <div className="flex items-stretch gap-3">{children}</div>
    </motion.div>
  );
}
