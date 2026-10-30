import { useDroppable } from '@dnd-kit/core';
import type { Stage } from '@jobflow/shared';
import { createContext, use } from 'react';

import { isLegalDrop } from '@/features/move-application';

export type DropState = 'idle' | 'allowed' | 'refused' | 'over';

export type DropZone = { setNodeRef: (element: HTMLElement | null) => void; drop: DropState };

type DropTarget = { from: Stage | null; to: Stage; isOver: boolean };

export const DragSourceContext = createContext<Stage | null>(null);

function dropStateOf({ from, to, isOver }: DropTarget): DropState {
  if (from === null || from === to) {
    return 'idle';
  }
  if (!isLegalDrop({ from, to })) {
    return 'refused';
  }
  return isOver ? 'over' : 'allowed';
}

export function useDropZone(stage: Stage): DropZone {
  const from = use(DragSourceContext);
  const accepts = from !== null && isLegalDrop({ from, to: stage });
  const { setNodeRef, isOver } = useDroppable({ id: stage, disabled: !accepts });
  return { setNodeRef, drop: dropStateOf({ from, to: stage, isOver }) };
}
