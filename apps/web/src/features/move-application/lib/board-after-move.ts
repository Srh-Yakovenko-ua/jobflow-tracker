import {
  type ApplicationBoardResponse,
  type ApplicationCard,
  applicationCardSchema,
  type Stage,
} from '@jobflow/shared';

import type { MovingApplication } from '@/entities/application';

export type BoardMove = Readonly<{ application: MovingApplication; toStage: Stage; at: string }>;

type BoardColumn = ApplicationBoardResponse['columns'][Stage];

function withoutCard(column: BoardColumn, id: ApplicationCard['id']): BoardColumn {
  return {
    count: Math.max(column.count - 1, 0),
    items: column.items && column.items.filter((card) => card.id !== id),
  };
}

function withCardOnTop(column: BoardColumn, card: ApplicationCard): BoardColumn {
  return { count: column.count + 1, items: column.items && [card, ...column.items] };
}

function movedCardOf(
  board: ApplicationBoardResponse,
  application: MovingApplication,
): ApplicationCard | undefined {
  const { items } = board.columns[application.currentStage];
  const held = items?.find((card) => card.id === application.id);
  if (held !== undefined) return held;
  const folded = applicationCardSchema.safeParse(application);
  return folded.success ? folded.data : undefined;
}

export function boardAfterMove(
  board: ApplicationBoardResponse,
  { application, toStage, at }: BoardMove,
): ApplicationBoardResponse {
  const card = movedCardOf(board, application);
  if (card === undefined) return board;
  const fromStage = application.currentStage;
  const moved: ApplicationCard = {
    ...card,
    currentStage: toStage,
    lastEventAt: at,
    daysInStage: 0,
    daysSinceLastEvent: 0,
    silenceLevel: 'none',
  };
  return {
    columns: {
      ...board.columns,
      [fromStage]: withoutCard(board.columns[fromStage], application.id),
      [toStage]: withCardOnTop(board.columns[toStage], moved),
    },
  };
}
