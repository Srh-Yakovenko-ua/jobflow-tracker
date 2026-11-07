import {
  DndContext,
  DragOverlay,
  type KeyboardCodes,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useDndContext,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { ApplicationBoardResponse } from '@jobflow/shared';
import { type ReactNode, useEffect, useEffectEvent } from 'react';

import { ApplicationCard, type ApplicationCardContext } from '@/entities/application';
import { type RejectionFlow, RejectionReasonDialog } from '@/features/reject-with-reason';
import { uk } from '@/shared/i18n';

import { boardCollisions } from '../model/board-collisions';
import { useBoardDensity } from '../model/board-density-store';
import { columnCoordinates } from '../model/column-coordinates';
import { dragAnnouncements } from '../model/drag-announcements';
import { DragSourceContext } from '../model/drag-source';
import { focusCardOrStrip } from '../model/focus-card-or-strip';
import { type BoardFocus, useBoardDrag } from '../model/use-board-drag';

export type BoardDndProps = Readonly<{
  board: ApplicationBoardResponse;
  context: ApplicationCardContext;
  children: ReactNode;
}>;

const ACTIVATION = {
  mouse: { distance: 5 },
  touch: { delay: 250, tolerance: 5 },
} as const;

const KEYBOARD_CODES: KeyboardCodes = {
  start: ['Space'],
  cancel: ['Escape', 'Tab'],
  end: ['Space'],
};

const OVERLAY =
  'scale-[1.02] rotate-[-1.6deg] cursor-grabbing rounded-xl shadow-e2 ring-3 ring-accent/25';

function useBoardSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: ACTIVATION.mouse }),
    useSensor(TouchSensor, { activationConstraint: ACTIVATION.touch }),
    useSensor(KeyboardSensor, {
      keyboardCodes: KEYBOARD_CODES,
      coordinateGetter: columnCoordinates,
      scrollBehavior: 'instant',
    }),
  );
}

function RejectionPromptDialog({ rejection }: Readonly<{ rejection: RejectionFlow }>) {
  const nodes = useDndContext();
  const { prompt, actions, focusBackRef } = rejection;
  return (
    <RejectionReasonDialog
      prompt={prompt}
      actions={actions}
      handlers={{
        onCloseAutoFocus: (event) => {
          event.preventDefault();
          const id = focusBackRef.current;
          if (id !== null) void focusCardOrStrip(nodes, id);
        },
      }}
    />
  );
}

function KeyboardDropFocus({ focus }: Readonly<{ focus: BoardFocus }>) {
  const nodes = useDndContext();
  const { request, onFocused } = focus;
  const focusPlaced = useEffectEvent((id: UniqueIdentifier) => {
    void focusCardOrStrip(nodes, id).then((focused) => {
      focused?.addEventListener(
        'focusout',
        () => {
          onFocused(request);
        },
        { once: true },
      );
    });
  });
  const id = request?.id ?? null;
  const stage = request?.stage ?? null;
  useEffect(() => {
    if (id !== null) focusPlaced(id);
  }, [id, stage]);
  return null;
}

export function BoardDnd({ board, context, children }: BoardDndProps) {
  const { activeCard, landing, dropAnimation, handlers, rejection, focus } = useBoardDrag(board);
  const sensors = useBoardSensors();
  const density = useBoardDensity((store) => store.density);
  const source = {
    from: activeCard?.currentStage ?? null,
    landing,
    activeId: activeCard?.id ?? null,
    focusId: focus.request?.id ?? null,
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisions}
      accessibility={{
        announcements: dragAnnouncements(board),
        screenReaderInstructions: { draggable: uk.board.move.a11y.instructions },
      }}
      {...handlers}
    >
      <DragSourceContext value={source}>{children}</DragSourceContext>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeCard && (
          <div className={OVERLAY}>
            <ApplicationCard application={activeCard} context={context} view={{ density }} />
          </div>
        )}
      </DragOverlay>
      <RejectionPromptDialog rejection={rejection} />
      <KeyboardDropFocus focus={focus} />
    </DndContext>
  );
}
