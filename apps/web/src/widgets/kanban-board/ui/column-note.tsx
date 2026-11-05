import { motion } from 'motion/react';
import type { Ref } from 'react';

import { FADE_PRESENCE } from '@/shared/ui/fade';

export type ColumnNoteProps = Readonly<{
  lines: readonly string[];
  ref?: Ref<HTMLParagraphElement>;
}>;

export function ColumnNote({ lines, ref }: ColumnNoteProps) {
  return (
    <motion.p
      ref={ref}
      layout
      {...FADE_PRESENCE}
      className="flex min-h-16.5 flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-line p-3 text-center text-[12px] leading-[1.5] text-ink-3"
    >
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </motion.p>
  );
}
