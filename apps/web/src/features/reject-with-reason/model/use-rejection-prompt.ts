import {
  type ApplicationResponse,
  type RejectionReasonCode,
  STAGE_MOVE_LIMITS,
} from '@jobflow/shared';
import { type UseMutateFunction, useQuery } from '@tanstack/react-query';
import { type Dispatch, type RefObject, type SetStateAction, useRef, useState } from 'react';

import type { ApplicationMove, MovingApplication } from '@/entities/application';
import { meQueryOptions } from '@/entities/user';

import { rememberLastReason } from '../lib/last-reason';
import type { RejectionActions, RejectionPrompt } from './rejection-step';

export type SendMove = UseMutateFunction<ApplicationResponse, Error, ApplicationMove>;

export type RejectionMutations = Readonly<{ send: SendMove; undo: SendMove }>;

type PickContext = Readonly<{
  send: SendMove;
  setPrompt: Dispatch<SetStateAction<RejectionPrompt | null>>;
  focusBackRef: RefObject<string | null>;
}>;

type ReasonChoice = Readonly<{ application: MovingApplication; reasonCode: RejectionReasonCode }>;

const REJECTED = 'rejected';

function pickReason(context: PickContext, { application, reasonCode }: ReasonChoice) {
  const undoUntil = Date.now() + STAGE_MOVE_LIMITS.undoWindowMs;
  const settle = (next: RejectionPrompt | null) => {
    context.setPrompt((current) =>
      current?.application.id === application.id && current.step.kind === 'saving' ? next : current,
    );
  };
  rememberLastReason(reasonCode);
  context.setPrompt({ application, step: { kind: 'saving', reasonCode } });
  context.send(
    { application, toStage: REJECTED, reasonCode },
    {
      onSuccess: () => {
        settle({ application, step: { kind: 'saved', reasonCode, undoUntil } });
      },
      onError: () => {
        context.focusBackRef.current = application.id;
        settle(null);
      },
    },
  );
}

function useAskReason({ send, setPrompt }: Pick<PickContext, 'send' | 'setPrompt'>) {
  const { data: askReason = true } = useQuery({
    ...meQueryOptions(),
    select: (me) => me.settings.askRejectionReason,
  });
  return ({ application }: Pick<ApplicationMove, 'application'>) => {
    if (!askReason) {
      send({ application, toStage: REJECTED });
      return;
    }
    setPrompt({ application, step: { kind: 'choose' } });
  };
}

export function useRejectionPrompt({ send, undo }: RejectionMutations) {
  const [prompt, setPrompt] = useState<RejectionPrompt | null>(null);
  const ask = useAskReason({ send, setPrompt });
  const focusBackRef = useRef<string | null>(null);
  const close = (focusId: string) => {
    focusBackRef.current = focusId;
    setPrompt(null);
  };
  const actions: RejectionActions = {
    onPick: (reasonCode) => {
      if (prompt?.step.kind !== 'choose') return;
      pickReason(
        { send, setPrompt, focusBackRef },
        { application: prompt.application, reasonCode },
      );
    },
    onCancel: () => {
      if (prompt !== null) close(prompt.application.id);
    },
    onUndo: () => {
      if (prompt?.step.kind !== 'saved') return;
      undo({ application: prompt.application, toStage: REJECTED });
      close(prompt.application.id);
    },
    onNote: () => {
      setPrompt((current) =>
        current?.step.kind === 'saved' ? { ...current, step: { kind: 'note' } } : current,
      );
    },
    onDone: () => {
      close(REJECTED);
    },
  };
  return { prompt, actions, focusBackRef, ask };
}

export type RejectionFlow = ReturnType<typeof useRejectionPrompt>;
