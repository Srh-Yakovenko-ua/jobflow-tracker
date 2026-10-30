import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDndContext,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { ApplicationBoardResponse } from '@jobflow/shared';
import type { ReactNode } from 'react';

import { ApplicationCard, type ApplicationCardContext } from '@/entities/application';
import { RejectionReasonDialog } from '@/features/reject-with-reason';
import { uk } from '@/shared/i18n';

import { dragAnnouncements } from '../model/drag-announcements';
import { DragSourceContext } from '../model/drag-source';
import { type RejectionPrompt, useBoardDrag } from '../model/use-board-drag';

export type BoardDndProps = Readonly<{
  board: ApplicationBoardResponse;
  context: ApplicationCardContext;
  children: ReactNode;
}>;

const ACTIVATION = {
  mouse: { distance: 5 },
  touch: { delay: 250, tolerance: 5 },
} as const;

const OVERLAY =
  'scale-[1.02] rotate-[-1.6deg] cursor-grabbing rounded-xl shadow-e2 ring-3 ring-accent/25';

function useBoardSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: ACTIVATION.mouse }),
    useSensor(TouchSensor, { activationConstraint: ACTIVATION.touch }),
  );
}

function RejectionPromptDialog({ rejection }: Readonly<{ rejection: RejectionPrompt }>) {
  const { draggableNodes, droppableContainers } = useDndContext();
  const { move, onPick, onCancel, focusBackRef } = rejection;
  return (
    <RejectionReasonDialog
      move={move}
      onPick={onPick}
      onCancel={onCancel}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        const id = focusBackRef.current;
        if (id === null) return;
        const card = draggableNodes.get(id)?.node.current;
        const strip = droppableContainers.get(id)?.node.current?.querySelector('button');
        (card ?? strip)?.focus();
      }}
    />
  );
}

export function BoardDnd({ board, context, children }: BoardDndProps) {
  const { activeCard, handlers, rejection } = useBoardDrag(board);
  const sensors = useBoardSensors();
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      accessibility={{
        announcements: dragAnnouncements(board),
        screenReaderInstructions: { draggable: uk.board.move.a11y.instructions },
      }}
      {...handlers}
    >
      <DragSourceContext value={activeCard?.currentStage ?? null}>{children}</DragSourceContext>
      <DragOverlay dropAnimation={null}>
        {activeCard && (
          <div className={OVERLAY}>
            <ApplicationCard application={activeCard} context={context} />
          </div>
        )}
      </DragOverlay>
      <RejectionPromptDialog rejection={rejection} />
    </DndContext>
  );
}
