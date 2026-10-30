import { type ApplicationCard, OPEN_STAGES, type OutcomeStage } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { boardOf, cardIn } from '@/test/board-fixtures';

import { boardAfterMove } from './board-after-move';

const MOVED: ApplicationCard = {
  ...cardIn({ serial: 1, stage: 'applied', position: 'Senior Frontend Engineer' }),
  silenceLevel: 'silent',
  daysInStage: 9,
  daysSinceLastEvent: 9,
};

const STAYING = cardIn({ serial: 2, stage: 'applied', position: 'Product Designer' });

const SCREENING = cardIn({ serial: 3, stage: 'screening', position: 'Go Backend Engineer' });

const AT = '2026-10-30T12:00:00.000Z';

function boardWith(expand: readonly OutcomeStage[]) {
  return boardOf(
    { applied: 2, screening: 1, rejected: 32, ghosted: 17 },
    { cards: [MOVED, STAYING, SCREENING], stages: [...OPEN_STAGES, ...expand] },
  );
}

describe('boardAfterMove', () => {
  it('takes the card out of its column and puts it on top of the target as a fresh, quiet event', () => {
    const board = boardAfterMove(boardWith([]), {
      application: MOVED,
      toStage: 'screening',
      at: AT,
    });

    expect(board.columns.applied).toEqual({ count: 1, items: [STAYING] });
    expect(board.columns.screening).toEqual({
      count: 2,
      items: [
        {
          ...MOVED,
          currentStage: 'screening',
          lastEventAt: AT,
          daysInStage: 0,
          daysSinceLastEvent: 0,
          silenceLevel: 'none',
        },
        SCREENING,
      ],
    });
  });

  it('a drop on a collapsed strip counts the card in and keeps the strip without items', () => {
    const board = boardAfterMove(boardWith([]), { application: MOVED, toStage: 'ghosted', at: AT });

    expect(board.columns.ghosted).toEqual({ count: 18, items: null });
    expect(board.columns.applied).toEqual({ count: 1, items: [STAYING] });
  });

  it('a drop on an expanded outcome column shows the card on top of its cards', () => {
    const board = boardAfterMove(boardWith(['rejected']), {
      application: MOVED,
      toStage: 'rejected',
      at: AT,
    });

    expect(board.columns.rejected.count).toBe(33);
    expect(board.columns.rejected.items?.map((card) => card.position)).toEqual([
      'Senior Frontend Engineer',
    ]);
  });

  it('a move from the vacancy page leaves a board that does not hold the card as it was', () => {
    const before = boardWith([]);
    const elsewhere = { id: '0b6f3c1e-5d2a-4c8e-9f10-0000000000aa', company: 'Acme' };

    const after = boardAfterMove(before, {
      application: { ...elsewhere, currentStage: 'tech_interview' },
      toStage: 'final',
      at: AT,
    });

    expect(after).toBe(before);
  });

  it('a move from the vacancy page moves the card the board holds, with the fields the board knows', () => {
    const after = boardAfterMove(boardWith([]), {
      application: { id: STAYING.id, company: STAYING.company, currentStage: 'applied' },
      toStage: 'screening',
      at: AT,
    });

    expect(after.columns.applied).toEqual({ count: 1, items: [MOVED] });
    expect(after.columns.screening.items?.[0]).toEqual({
      ...STAYING,
      currentStage: 'screening',
      lastEventAt: AT,
      daysInStage: 0,
      daysSinceLastEvent: 0,
      silenceLevel: 'none',
    });
  });

  it('leaves the board it was given and every other column as they were', () => {
    const before = boardWith([]);
    const snapshot = structuredClone(before);

    const after = boardAfterMove(before, { application: MOVED, toStage: 'screening', at: AT });

    expect(before).toEqual(snapshot);
    expect(after.columns.tech_interview).toBe(before.columns.tech_interview);
    expect(after.columns.rejected).toBe(before.columns.rejected);
  });
});
