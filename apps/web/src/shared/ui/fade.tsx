'use client';

import { motion, useIsPresent } from 'motion/react';
import type { ReactNode, Ref } from 'react';

export type FadeProps = Readonly<{
  children: ReactNode;
  className?: string;
  layout?: 'position';
  ref?: Ref<HTMLDivElement>;
}>;

export const FADE_PRESENCE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

export function Fade({ children, className, layout, ref }: FadeProps) {
  const present = useIsPresent();
  return (
    <motion.div
      ref={ref}
      layout={layout ?? false}
      inert={!present}
      className={className}
      {...FADE_PRESENCE}
    >
      {children}
    </motion.div>
  );
}
