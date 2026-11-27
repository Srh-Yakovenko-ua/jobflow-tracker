'use client';

import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { type ReactNode, useRef } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { prefersReducedMotion } from '@/shared/lib/reduced-motion';
import { Button } from '@/shared/ui/button';

import { useMoreToTheRight } from '../model/use-more-to-the-right';
import { BOARD_FRAME } from './column-frame';

export type BoardFrameProps = Readonly<{ children: ReactNode; busy?: boolean }>;

const SCROLL_SHARE = 0.8;

function scrollRight(scroller: HTMLElement | null) {
  if (scroller === null) return;
  scroller.scrollBy({
    left: scroller.clientWidth * SCROLL_SHARE,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
}

export function BoardFrame({ children, busy }: BoardFrameProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const moreToTheRight = useMoreToTheRight(scrollerRef);
  return (
    <div className={cn(BOARD_FRAME.width, 'relative')}>
      <motion.div ref={scrollerRef} layoutScroll aria-busy={busy} className="overflow-x-auto p-1">
        <div className="flex items-stretch gap-3">{children}</div>
      </motion.div>
      {moreToTheRight && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-linear-to-l from-paper to-transparent"
          />
          <Button
            variant="outline"
            size="sm"
            icon={<ChevronRight aria-hidden size={16} strokeWidth={1.9} />}
            aria-label={uk.board.scrollRight}
            className="absolute top-2 right-2 bg-surface shadow-e1"
            onClick={() => {
              scrollRight(scrollerRef.current);
            }}
          />
        </>
      )}
    </div>
  );
}
