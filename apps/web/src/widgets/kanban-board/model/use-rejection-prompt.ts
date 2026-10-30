import type { UniqueIdentifier } from '@dnd-kit/core';
import { type ApplicationCard, type RejectionReasonCode, STAGE_MOVE_LIMITS } from '@jobflow/shared';
import { type Dispatch, type RefObject, type SetStateAction, useRef, useState } from 'react';

import {
  type ApplicationMove,
  type useMoveApplicationMutation,
  useUndoMoveMutation,
} from '@/features/move-application';
import {
  type RejectionActions,
  type RejectionPrompt,
  rememberLastReason,
} from '@/features/reject-with-reason';

type SendMove = ReturnType<typeof useMoveApplicationMutation>['mutate'];

type PickContext = Readonly<{
  send: SendMove;
  setPrompt: Dispatch<SetStateAction<RejectionPrompt | null>>;
  focusBackRef: RefObject<UniqueIdentifier | null>;
}>;

type ReasonChoice = Readonly<{ application: ApplicationCard; reasonCode: RejectionReasonCode }>;

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

export function useRejectionPrompt(send: SendMove) {
  const [prompt, setPrompt] = useState<RejectionPrompt | null>(null);
  const focusBackRef = useRef<UniqueIdentifier | null>(null);
  const { mutate: undo } = useUndoMoveMutation();
  const close = (focusId: UniqueIdentifier) => {
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
  const ask = ({ application }: ApplicationMove) => {
    setPrompt({ application, step: { kind: 'choose' } });
  };
  return { prompt, actions, focusBackRef, ask };
}

export type RejectionFlow = ReturnType<typeof useRejectionPrompt>;
