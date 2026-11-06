import { useQueryClient } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import { http } from 'msw/http';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { applicationKeys } from '@/entities/application';
import { apiUrl, errorReply } from '@/test/api-handlers';
import { cardIn, moveRoute, type MoveRouteOptions } from '@/test/board-fixtures';
import { latch } from '@/test/latch';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { type BulkMoveInput, useBulkMoveMutation } from './use-bulk-move-mutation';

const APPLIED = cardIn({ serial: 1, stage: 'applied', position: 'Senior Frontend Engineer' });
const SCREENING = cardIn({ serial: 2, stage: 'screening', position: 'Go Backend Engineer' });
const TECH = cardIn({ serial: 3, stage: 'tech_interview', position: 'Platform Engineer' });
const OFFER = cardIn({ serial: 4, stage: 'offer', position: 'Frontend Engineer' });
const REJECTED = cardIn({ serial: 5, stage: 'rejected', position: 'Middle QA Engineer' });
const GHOSTED = cardIn({ serial: 6, stage: 'ghosted', position: 'Data Engineer' });
const WITHDRAWN = cardIn({ serial: 7, stage: 'withdrawn', position: 'Product Designer' });

const TABLE_KEY = applicationKeys.table({});

function renderBulkMove(control: MoveRouteOptions = {}) {
  const moves = moveRoute(control);
  server.use(moves.handler);
  const { result } = renderHookInApp(() => ({
    bulk: useBulkMoveMutation(),
    queryClient: useQueryClient(),
  }));
  act(() => {
    result.current.queryClient.setQueryData(TABLE_KEY, []);
  });
  const move = (input: BulkMoveInput) => {
    act(() => {
      result.current.bulk.move(input);
    });
  };
  return { result, move, sent: moves.sent };
}

afterEach(() => {
  toast.dismiss();
});

describe('useBulkMoveMutation', () => {
  it('moves the rows to their next stage one at a time with each from-stage, then refreshes the table once', async () => {
    const held = latch();
    const { result, move, sent } = renderBulkMove({ latch: held });

    move({ applications: [APPLIED, SCREENING], target: 'next' });
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent).toEqual([{ fromStage: 'applied', toStage: 'screening' }]);
    held.release();

    expect(await screen.findByText('Перенесено 2 вакансії')).toBeDefined();
    expect(sent).toEqual([
      { fromStage: 'applied', toStage: 'screening' },
      { fromStage: 'screening', toStage: 'tech_interview' },
    ]);
    await waitFor(() => {
      expect(result.current.queryClient.getQueryState(TABLE_KEY)?.isInvalidated).toBe(true);
    });
  });

  it('a move to the next stage skips the offer and every outcome row and counts them', async () => {
    const { move, sent } = renderBulkMove();

    move({ applications: [OFFER, REJECTED, GHOSTED, WITHDRAWN, APPLIED], target: 'next' });

    expect(await screen.findByText('Перенесено 1 вакансію')).toBeDefined();
    expect(screen.getByText('Пропущено 4 вакансії: для них такого переходу немає.')).toBeDefined();
    expect(sent).toEqual([{ fromStage: 'applied', toStage: 'screening' }]);
  });

  it('withdrawing skips the rows already rejected, ghosted or withdrawn', async () => {
    const { move, sent } = renderBulkMove();

    move({ applications: [APPLIED, REJECTED, OFFER, GHOSTED, WITHDRAWN], target: 'withdrawn' });

    expect(await screen.findByText('Перенесено 2 вакансії')).toBeDefined();
    expect(screen.getByText('Пропущено 3 вакансії: для них такого переходу немає.')).toBeDefined();
    expect(sent).toEqual([
      { fromStage: 'applied', toStage: 'withdrawn' },
      { fromStage: 'offer', toStage: 'withdrawn' },
    ]);
  });

  it('a 409 on one row counts it as failed and the rows after it still move', async () => {
    const { move, sent } = renderBulkMove();
    server.use(
      http.post(apiUrl(`/applications/${SCREENING.id}/events`), () =>
        errorReply({ status: 409, type: 'conflict' }),
      ),
    );

    move({ applications: [APPLIED, SCREENING, TECH], target: 'next' });

    expect(await screen.findByText('Перенесено 2 вакансії')).toBeDefined();
    expect(screen.getByText('Не вдалося перенести 1 вакансію.')).toBeDefined();
    expect(sent).toEqual([
      { fromStage: 'applied', toStage: 'screening' },
      { fromStage: 'tech_interview', toStage: 'final' },
    ]);
  });

  it('a second call while a move is held sends nothing and shows one summary', async () => {
    const held = latch();
    const { move, sent } = renderBulkMove({ latch: held });

    move({ applications: [APPLIED], target: 'next' });
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    move({ applications: [SCREENING], target: 'next' });
    held.release();

    expect(await screen.findByText('Перенесено 1 вакансію')).toBeDefined();
    expect(sent).toEqual([{ fromStage: 'applied', toStage: 'screening' }]);
    expect(toast.getToasts()).toHaveLength(1);
  });
});
