import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { Kbd } from '@/shared/ui/kbd';

const COPY = uk.bookmarklet;

const KEYS = 'text-[12px] font-semibold tracking-normal';

type StepLineProps = Readonly<{ index: string; children: ReactNode }>;

function StepLine({ index, children }: StepLineProps) {
  return (
    <p className="flex items-start gap-2.5 text-[13.5px] leading-[1.5]">
      <span
        aria-hidden
        className="flex-none pt-0.75 text-[11px] leading-[1.5] font-semibold text-link tabular-nums"
      >
        {index}
      </span>
      <span>{children}</span>
    </p>
  );
}

export type InstallStepsProps = Readonly<{ children: ReactNode }>;

export function InstallSteps({ children }: InstallStepsProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border-[1.5px] border-dashed border-line bg-surface-2 p-3.5">
      <p className="text-[10px] leading-[1.3] font-semibold tracking-[0.1em] text-ink-3 uppercase">
        {COPY.eyebrow}
      </p>
      <ol className="flex flex-col gap-3">
        <li>
          <StepLine index="1">
            {COPY.steps.showBar} <Kbd className={KEYS}>{COPY.steps.keys.mac}</Kbd> {COPY.steps.or}{' '}
            <Kbd className={KEYS}>{COPY.steps.keys.other}</Kbd>
          </StepLine>
        </li>
        <li className="flex flex-col items-start gap-3">
          <StepLine index="2">{COPY.steps.drag}</StepLine>
          {children}
        </li>
        <li>
          <StepLine index="3">{COPY.steps.click}</StepLine>
        </li>
      </ol>
    </div>
  );
}
