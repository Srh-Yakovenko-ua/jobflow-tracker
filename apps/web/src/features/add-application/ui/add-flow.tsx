'use client';

import { AnimatePresence } from 'motion/react';
import { type ReactNode, useState } from 'react';

import { Fade } from '@/shared/ui/fade';

import type { AddedApplication } from '../model/use-add-application';
import { AddedNotice } from './added-notice';

export type AddStep = Readonly<{
  first: boolean;
  autoFocus: boolean;
  onAdded: (added: AddedApplication) => void;
}>;

export type AddFlowProps = Readonly<{
  focusOnMount: boolean;
  children: (step: AddStep) => ReactNode;
}>;

type Flow = Readonly<{ round: number; added: AddedApplication | null }>;

const FIRST_ROUND: Flow = { round: 0, added: null };

export function AddFlow({ focusOnMount, children }: AddFlowProps) {
  const [flow, setFlow] = useState(FIRST_ROUND);
  const first = flow.round === 0;
  const onAdded = (added: AddedApplication) => {
    setFlow((current) => ({ ...current, added }));
  };
  const onAddAnother = () => {
    setFlow((current) => ({ round: current.round + 1, added: null }));
  };
  return (
    <div className="relative">
      <AnimatePresence mode="popLayout" initial={false}>
        {flow.added === null ? (
          <Fade key={`form-${String(flow.round)}`}>
            {children({ first, autoFocus: focusOnMount || !first, onAdded })}
          </Fade>
        ) : (
          <Fade key="added">
            <AddedNotice added={flow.added} actions={{ onAddAnother }} />
          </Fade>
        )}
      </AnimatePresence>
    </div>
  );
}
