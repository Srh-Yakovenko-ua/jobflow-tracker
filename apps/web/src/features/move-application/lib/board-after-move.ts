import type { ApplicationBoardResponse, ApplicationCard, Stage } from '@jobflow/shared';

export type BoardMove = Readonly<{ application: ApplicationCard; toStage: Stage; at: string }>;

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

export function boardAfterMove(
  board: ApplicationBoardResponse,
  { application, toStage, at }: BoardMove,
): ApplicationBoardResponse {
  const fromStage = application.currentStage;
  const moved: ApplicationCard = {
    ...application,
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
