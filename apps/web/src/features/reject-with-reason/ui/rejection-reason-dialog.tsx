'use client';

import type { RejectionReasonCode } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';
import type { KeyboardEvent } from 'react';

import { useLastPresent } from '@/shared/lib/use-last-present';
import {
  Dialog,
  DialogContent,
  type DialogContentHandlers,
  keepFocusOnDialog,
} from '@/shared/ui/dialog';
import { Fade } from '@/shared/ui/fade';

import { readLastReason } from '../lib/last-reason';
import { reasonForKey } from '../lib/reason-order';
import type { RejectionActions, RejectionPrompt, RejectionStep } from '../model/rejection-step';
import { ReasonPicker } from './reason-picker';
import { RejectionNote } from './rejection-note';
import { RejectionSaved } from './rejection-saved';
import { stepHeader } from './step-header';

export type RejectionReasonDialogProps = Readonly<{
  prompt: RejectionPrompt | null;
  actions: RejectionActions;
  handlers?: Pick<DialogContentHandlers, 'onCloseAutoFocus'>;
}>;

type StepBodyProps = Readonly<{ prompt: RejectionPrompt; actions: RejectionActions }>;

const STEP_BODY: Record<RejectionStep['kind'], string> = {
  choose: 'reasons',
  saving: 'reasons',
  saved: 'saved',
  note: 'note',
};

function keyedReason(event: KeyboardEvent<HTMLDivElement>): RejectionReasonCode | undefined {
  if (event.ctrlKey || event.metaKey || event.altKey) return undefined;
  if (event.key === 'Enter') {
    return event.target === event.currentTarget ? readLastReason() : undefined;
  }
  return reasonForKey(event.key);
}

function StepBody({ prompt, actions }: StepBodyProps) {
  const { application, step } = prompt;
  switch (step.kind) {
    case 'choose':
    case 'saving':
      return <ReasonPicker onPick={actions.onPick} />;
    case 'saved':
      return <RejectionSaved application={application} step={step} actions={actions} />;
    case 'note':
      return <RejectionNote application={application} actions={actions} />;
    default: {
      const unhandled: never = step;
      throw new Error(`Unknown rejection step ${JSON.stringify(unhandled)}`);
    }
  }
}

export function RejectionReasonDialog({ prompt, actions, handlers }: RejectionReasonDialogProps) {
  const shown = useLastPresent(prompt);
  const choosing = prompt?.step.kind === 'choose';
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const reasonCode = choosing ? keyedReason(event) : undefined;
    if (reasonCode === undefined) return;
    event.preventDefault();
    actions.onPick(reasonCode);
  };
  return (
    <Dialog
      open={prompt !== null}
      onOpenChange={(open) => {
        if (open) return;
        if (choosing) actions.onCancel();
        else actions.onDone();
      }}
    >
      {shown && (
        <DialogContent
          className="max-w-140"
          header={stepHeader(shown)}
          handlers={{ ...handlers, onOpenAutoFocus: keepFocusOnDialog, onKeyDown }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <Fade key={STEP_BODY[shown.step.kind]} className="flex flex-col gap-4.5">
              <StepBody prompt={shown} actions={actions} />
            </Fade>
          </AnimatePresence>
        </DialogContent>
      )}
    </Dialog>
  );
}
