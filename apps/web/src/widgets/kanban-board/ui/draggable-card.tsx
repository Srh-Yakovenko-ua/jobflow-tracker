import { useDraggable } from '@dnd-kit/core';
import Link from 'next/link';

import {
  ApplicationCard,
  type ApplicationCardProps,
  cardHrefOf,
  draftStateOf,
} from '@/entities/application';
import { canDragFrom } from '@/features/move-application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { KeyboardHint } from './keyboard-hint';

export type DraggableCardProps = Pick<ApplicationCardProps, 'application' | 'context' | 'view'>;

const CARD_LINK = 'block rounded-xl focus-visible:focus-ring';

const HANDLE =
  'cursor-grab touch-manipulation select-none [-webkit-touch-callout:none] active:cursor-grabbing';

function cardLinkOf(application: DraggableCardProps['application']) {
  return {
    href: cardHrefOf(application),
    scroll: draftStateOf(application) === 'review',
    prefetch: false,
  } as const;
}

function DragHandle(card: DraggableCardProps) {
  const { application } = card;
  const { setNodeRef, attributes, listeners, isDragging, activatorEvent } = useDraggable({
    id: application.id,
    attributes: { roleDescription: uk.board.move.a11y.roleDescription },
  });
  return (
    <>
      <Link
        {...cardLinkOf(application)}
        draggable={false}
        ref={setNodeRef}
        aria-roledescription={attributes['aria-roledescription']}
        aria-describedby={attributes['aria-describedby']}
        aria-disabled={attributes['aria-disabled']}
        {...listeners}
        className={cn(CARD_LINK, HANDLE, isDragging && 'opacity-40')}
      >
        <ApplicationCard {...card} />
      </Link>
      {isDragging && activatorEvent instanceof KeyboardEvent && <KeyboardHint />}
    </>
  );
}

export function DraggableCard(card: DraggableCardProps) {
  const { application } = card;
  if (!canDragFrom(application.currentStage)) {
    return (
      <Link {...cardLinkOf(application)} className={CARD_LINK}>
        <ApplicationCard {...card} />
      </Link>
    );
  }
  return <DragHandle {...card} />;
}
