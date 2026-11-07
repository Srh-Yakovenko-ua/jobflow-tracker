import { useMoveApplicationMutation, useUndoMoveMutation } from '@/features/move-application';
import { type RejectionMutations, useRejectionPrompt } from '@/features/reject-with-reason';

import { focusBack } from './use-shell-surfaces';

export function usePaletteMove(opener: HTMLElement | null) {
  const { mutate } = useMoveApplicationMutation();
  const { mutate: undo } = useUndoMoveMutation();
  const send: RejectionMutations['send'] = (move, options) => {
    mutate(move, {
      ...options,
      onSettled: (...settled) => {
        options?.onSettled?.(...settled);
        if (document.activeElement === document.body) focusBack(opener);
      },
    });
  };
  const rejection = useRejectionPrompt({ send, undo });
  return { rejection, moveTo: rejection.sendOrAsk };
}

export type PaletteMove = ReturnType<typeof usePaletteMove>;
