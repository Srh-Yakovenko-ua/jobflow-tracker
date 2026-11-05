'use client';

import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { type ReactNode, type Ref, useState } from 'react';

import { cn } from '@/shared/lib/cn';

export type RevealProps = Readonly<{
  shown: boolean;
  children: ReactNode;
  className?: string;
  mode?: 'sync' | 'popLayout';
}>;

type RevealBodyProps = Readonly<{
  children: ReactNode;
  className?: string | undefined;
  ref?: Ref<HTMLDivElement>;
}>;

const HEIGHT = {
  shown: { height: 'auto', opacity: 1 },
  hidden: { height: 0, opacity: 0 },
} as const;

function RevealBody({ children, className, ref }: RevealBodyProps) {
  const present = useIsPresent();
  const [moving, setMoving] = useState(false);
  return (
    <motion.div
      ref={ref}
      inert={!present}
      className={cn(moving && 'overflow-clip', className)}
      initial={HEIGHT.hidden}
      animate={HEIGHT.shown}
      exit={HEIGHT.hidden}
      onAnimationStart={() => {
        setMoving(true);
      }}
      onAnimationComplete={() => {
        setMoving(false);
      }}
    >
      {children}
    </motion.div>
  );
}

export function Reveal({ shown, children, className, mode = 'sync' }: RevealProps) {
  return (
    <AnimatePresence initial={false} mode={mode}>
      {shown && (
        <RevealBody key="reveal" className={className}>
          {children}
        </RevealBody>
      )}
    </AnimatePresence>
  );
}
