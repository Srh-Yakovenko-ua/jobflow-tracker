import { useDraggable } from '@dnd-kit/core';

import { ApplicationCard, type ApplicationCardProps } from '@/entities/application';
import { canDragFrom } from '@/features/move-application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

export type DraggableCardProps = Pick<ApplicationCardProps, 'application' | 'context'>;

const HANDLE =
  'cursor-grab touch-manipulation rounded-xl select-none [-webkit-touch-callout:none] focus-visible:focus-ring active:cursor-grabbing';

function DragHandle({ application, context }: DraggableCardProps) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: application.id,
    attributes: { roleDescription: uk.board.move.a11y.roleDescription },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(HANDLE, isDragging && 'opacity-40')}
    >
      <ApplicationCard application={application} context={context} />
    </div>
  );
}

export function DraggableCard({ application, context }: DraggableCardProps) {
  if (!canDragFrom(application.currentStage)) {
    return <ApplicationCard application={application} context={context} />;
  }
  return <DragHandle application={application} context={context} />;
}
