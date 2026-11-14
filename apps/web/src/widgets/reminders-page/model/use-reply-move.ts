'use client';

import { useMoveApplicationMutation, useUndoMoveMutation } from '@/features/move-application';
import { useRejectionPrompt } from '@/features/reject-with-reason';

export function useReplyMove() {
  const { mutate: send } = useMoveApplicationMutation();
  const { mutate: undo } = useUndoMoveMutation();
  const rejection = useRejectionPrompt({ send, undo });
  return { rejection, moveTo: rejection.sendOrAsk };
}

export type ReplyMove = ReturnType<typeof useReplyMove>;
