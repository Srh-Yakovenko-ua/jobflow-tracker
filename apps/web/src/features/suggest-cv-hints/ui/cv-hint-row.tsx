'use client';

import type { CvHint } from '@jobflow/shared';
import { motion } from 'motion/react';

import { uk } from '@/shared/i18n';
import { CopyButton } from '@/shared/ui/copy-button';
import { ROW } from '@/shared/ui/list-stagger';

export type CvHintRowProps = Readonly<{ hint: CvHint }>;

const COPY = uk.cvHints;

export function CvHintRow({ hint }: CvHintRowProps) {
  return (
    <motion.li
      variants={ROW}
      className="flex flex-col gap-1.5 pb-3 shadow-[inset_0_-1px_0_var(--line-soft)] last:pb-0 last:shadow-none"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <span className="text-[14px] font-semibold wrap-anywhere">{hint.requirement}</span>
        <span className="flex items-center gap-2">
          <span className="font-ui text-[12px] font-semibold text-ink-2 tabular-nums">
            {COPY.impact(hint.expectedScoreImpact)}
          </span>
          <CopyButton value={hint.suggestion} label={COPY.copy(hint.requirement)} />
        </span>
      </div>
      <p className="pl-3 text-[13px] leading-[1.55] wrap-anywhere text-ink-3 shadow-[inset_2px_0_0_var(--line-soft)]">
        {COPY.evidence(hint.evidenceInCv)}
      </p>
      <p className="text-[14px] leading-[1.5] wrap-anywhere">{hint.suggestion}</p>
    </motion.li>
  );
}
