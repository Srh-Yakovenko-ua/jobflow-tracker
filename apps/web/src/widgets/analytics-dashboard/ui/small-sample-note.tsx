'use client';

import { AnimatePresence } from 'motion/react';

import { uk } from '@/shared/i18n';
import { Fade } from '@/shared/ui/fade';

import type { NoteLine } from '../lib/interval-bars';

const COPY = uk.analytics.small;

export type SmallSampleNoteProps = Readonly<{ lines: readonly NoteLine[] }>;

export function SmallSampleNote({ lines }: SmallSampleNoteProps) {
  return (
    <AnimatePresence initial={false}>
      {lines.length > 0 && (
        <Fade
          key="small"
          className="flex items-start gap-2.5 rounded-[10px] bg-surface-2 px-3.25 py-2.75 text-[12.5px] leading-normal text-ink-2 tabular-nums"
        >
          <span className="flex-none pt-px text-[11px] font-semibold text-ink-3">{COPY.tag}</span>
          <ul className="flex min-w-0 flex-col gap-1">
            {lines.map(({ key, text }) => (
              <li key={key}>{text}</li>
            ))}
          </ul>
        </Fade>
      )}
    </AnimatePresence>
  );
}
