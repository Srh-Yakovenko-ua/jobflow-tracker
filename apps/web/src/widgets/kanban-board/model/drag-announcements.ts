import type { Announcements, UniqueIdentifier } from '@dnd-kit/core';
import { type ApplicationBoardResponse, STAGE_LABELS } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

import { findCard, stageOf } from './board-lookup';

const A11Y = uk.board.move.a11y;

type DragMoment = Parameters<Announcements['onDragOver']>[0];

export function dragAnnouncements(board: ApplicationBoardResponse): Announcements {
  const positionOf = (id: UniqueIdentifier) => findCard(board, id)?.position ?? '';
  const namesOf = ({ active, over }: DragMoment) => {
    const stage = stageOf(over);
    return {
      position: positionOf(active.id),
      stage: stage === undefined ? undefined : STAGE_LABELS[stage].labelUk,
    };
  };
  return {
    onDragStart: ({ active }) => A11Y.pickedUp(positionOf(active.id)),
    onDragOver: (moment) => A11Y.over(namesOf(moment)),
    onDragEnd: (moment) => A11Y.dropped(namesOf(moment)),
    onDragCancel: ({ active }) => A11Y.cancelled(positionOf(active.id)),
  };
}
