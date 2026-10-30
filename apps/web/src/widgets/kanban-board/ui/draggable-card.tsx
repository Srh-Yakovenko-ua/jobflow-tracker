import { useDraggable } from '@dnd-kit/core';
import Link from 'next/link';

import { ApplicationCard, type ApplicationCardProps } from '@/entities/application';
import { canDragFrom } from '@/features/move-application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

export type DraggableCardProps = Pick<ApplicationCardProps, 'application' | 'context'>;

const CARD_LINK = 'block rounded-xl focus-visible:focus-ring';

const HANDLE =
  'cursor-grab touch-manipulation select-none [-webkit-touch-callout:none] active:cursor-grabbing';

function pageOf(application: DraggableCardProps['application']): string {
  return `/applications/${application.id}`;
}

function DragHandle({ application, context }: DraggableCardProps) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: application.id,
    attributes: { roleDescription: uk.board.move.a11y.roleDescription },
  });
  return (
    <Link
      href={pageOf(application)}
      scroll={false}
      prefetch={false}
      draggable={false}
      ref={setNodeRef}
      aria-roledescription={attributes['aria-roledescription']}
      aria-describedby={attributes['aria-describedby']}
      aria-disabled={attributes['aria-disabled']}
      {...listeners}
      className={cn(CARD_LINK, HANDLE, isDragging && 'opacity-40')}
    >
      <ApplicationCard application={application} context={context} />
    </Link>
  );
}

export function DraggableCard({ application, context }: DraggableCardProps) {
  if (!canDragFrom(application.currentStage)) {
    return (
      <Link href={pageOf(application)} scroll={false} prefetch={false} className={CARD_LINK}>
        <ApplicationCard application={application} context={context} />
      </Link>
    );
  }
  return <DragHandle application={application} context={context} />;
}
