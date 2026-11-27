'use client';

import { CircleDashed } from 'lucide-react';
import { motion } from 'motion/react';
import { type ReactNode, useId } from 'react';

import { usePrefersReducedMotion } from '@/shared/lib/reduced-motion';

import { LIST, LIST_STILL } from './list-stagger';

export type StaggeredListTitle = Readonly<{ text: string; marker: 'filled' | 'dashed' }>;

export type StaggeredListProps = Readonly<{
  label: string | StaggeredListTitle;
  className: string;
  children: ReactNode;
  empty?: ReactNode;
}>;

const MARKERS: Record<StaggeredListTitle['marker'], ReactNode> = {
  filled: <span aria-hidden className="size-2.25 flex-none rounded-pill bg-accent" />,
  dashed: (
    <CircleDashed aria-hidden size={16} strokeWidth={1.9} className="flex-none text-ghosted" />
  ),
};

export function StaggeredList({ label, className, children, empty }: StaggeredListProps) {
  const titleId = useId();
  const reduced = usePrefersReducedMotion();
  const titled = typeof label !== 'string';
  const list =
    empty !== undefined ? (
      <p className={className}>{empty}</p>
    ) : (
      <motion.ul
        aria-label={titled ? undefined : label}
        aria-labelledby={titled ? titleId : undefined}
        variants={reduced ? LIST_STILL : LIST}
        initial="hidden"
        animate="shown"
        className={className}
      >
        {children}
      </motion.ul>
    );
  if (!titled) return list;
  return (
    <div className="flex flex-col gap-2.5">
      <h3 id={titleId} className="flex items-center gap-2 text-[13px] font-semibold">
        {MARKERS[label.marker]}
        {label.text}
      </h3>
      {list}
    </div>
  );
}
