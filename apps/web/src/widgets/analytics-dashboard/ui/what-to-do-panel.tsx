'use client';

import { AnimatePresence } from 'motion/react';

import { uk } from '@/shared/i18n';
import { ChartFrame } from '@/shared/ui/chart-frame';
import { Fade } from '@/shared/ui/fade';
import { NumberedAction } from '@/shared/ui/numbered-action';

import type { ActionsView } from '../model/dashboard-view';

const COPY = uk.analytics.whatToDo;

export type WhatToDoPanelProps = Readonly<{ view: ActionsView }>;

export function WhatToDoPanel({ view }: WhatToDoPanelProps) {
  const { state, actions = [] } = view;
  const shown = !view.hidden && (state.status !== 'ready' || actions.length > 0);
  return (
    <AnimatePresence initial={false}>
      {shown && (
        <Fade key="what-to-do">
          <ChartFrame header={{ eyebrow: COPY.eyebrow }} state={state} view={{ plot: 'open' }}>
            <ol aria-label={COPY.list} className="flex flex-col gap-3.25">
              {actions.map((action, index) => (
                <NumberedAction
                  key={`${action.block}:${action.title}`}
                  action={{
                    position: index + 1,
                    title: action.title,
                    lines: [action.expectedEffect],
                  }}
                  view={{ tone: 'accent' }}
                />
              ))}
            </ol>
          </ChartFrame>
        </Fade>
      )}
    </AnimatePresence>
  );
}
