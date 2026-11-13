'use client';

import type { InsightAction } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';

import { uk } from '@/shared/i18n';
import { ChartFrame } from '@/shared/ui/chart-frame';
import { Fade } from '@/shared/ui/fade';

import type { ActionsView } from '../model/dashboard-view';

const COPY = uk.analytics.whatToDo;

export type WhatToDoPanelProps = Readonly<{ view: ActionsView }>;

type ActionItemProps = Readonly<{ action: InsightAction; position: number }>;

function ActionItem({ action, position }: ActionItemProps) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="grid size-5.5 flex-none place-items-center rounded-[7px] bg-accent-tint text-[11px] font-semibold text-accent-ink tabular-nums"
      >
        {position}
      </span>
      <div className="flex min-w-0 flex-col gap-0.75">
        <p className="text-[13.5px] leading-[1.4] font-semibold text-pretty text-ink">
          {action.title}
        </p>
        <p className="text-[12.5px] leading-[1.5] text-pretty text-ink-2 tabular-nums">
          {action.expectedEffect}
        </p>
      </div>
    </li>
  );
}

export function WhatToDoPanel({ view }: WhatToDoPanelProps) {
  const { state, actions = [] } = view;
  const shown = state.status !== 'ready' || actions.length > 0;
  return (
    <AnimatePresence initial={false}>
      {shown && (
        <Fade key="what-to-do">
          <ChartFrame header={{ eyebrow: COPY.eyebrow }} state={state} view={{ plot: 'open' }}>
            <ol aria-label={COPY.list} className="flex flex-col gap-3.25">
              {actions.map((action, index) => (
                <ActionItem
                  key={`${action.block}:${action.title}`}
                  action={action}
                  position={index + 1}
                />
              ))}
            </ol>
          </ChartFrame>
        </Fade>
      )}
    </AnimatePresence>
  );
}
