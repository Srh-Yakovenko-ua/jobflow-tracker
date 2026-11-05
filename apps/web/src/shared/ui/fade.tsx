'use client';

import { motion, type Transition, useIsPresent } from 'motion/react';
import type { ReactNode, Ref } from 'react';

export type FadeMotion = Readonly<{
  layout?: true | 'position';
  layoutId?: string;
  transition?: Transition;
}>;

export type FadeProps = Readonly<{
  children: ReactNode;
  className?: string;
  motion?: FadeMotion;
  ref?: Ref<HTMLDivElement>;
}>;

export const FADE_PRESENCE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

export function Fade({ children, className, motion: layoutMotion, ref }: FadeProps) {
  const present = useIsPresent();
  return (
    <motion.div
      ref={ref}
      {...layoutMotion}
      inert={!present}
      className={className}
      {...FADE_PRESENCE}
    >
      {children}
    </motion.div>
  );
}
