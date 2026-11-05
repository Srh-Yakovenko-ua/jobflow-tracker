'use client';

import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import type { ReactNode, RefCallback } from 'react';

import { cn } from '@/shared/lib/cn';
import { useMoving } from '@/shared/lib/use-moving';

type RevealTag = 'div' | 'span';

export type RevealView = Readonly<{
  mode?: 'sync' | 'popLayout';
  as?: RevealTag;
}>;

export type RevealProps = Readonly<{
  shown: boolean;
  children: ReactNode;
  className?: string;
  view?: RevealView;
}>;

type RevealBodyProps = Readonly<{
  as: RevealTag;
  children: ReactNode;
  className?: string | undefined;
  ref?: RefCallback<HTMLElement>;
}>;

const HEIGHT = {
  shown: { height: 'auto', opacity: 1 },
  hidden: { height: 0, opacity: 0 },
} as const;

const BODY = { div: motion.div, span: motion.span } as const;

function RevealBody({ as, children, className, ref }: RevealBodyProps) {
  const present = useIsPresent();
  const { moving, start, end } = useMoving();
  const Body = BODY[as];
  return (
    <Body
      ref={ref}
      inert={!present}
      className={cn(moving && 'overflow-clip', className)}
      initial={HEIGHT.hidden}
      animate={HEIGHT.shown}
      exit={HEIGHT.hidden}
      onAnimationStart={start}
      onAnimationComplete={end}
    >
      {children}
    </Body>
  );
}

export function Reveal({ shown, children, className, view = {} }: RevealProps) {
  const { mode = 'sync', as = 'div' } = view;
  return (
    <AnimatePresence initial={false} mode={mode}>
      {shown && (
        <RevealBody key="reveal" as={as} className={className}>
          {children}
        </RevealBody>
      )}
    </AnimatePresence>
  );
}
