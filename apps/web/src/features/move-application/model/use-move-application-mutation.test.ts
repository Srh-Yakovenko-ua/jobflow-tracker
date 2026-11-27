import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, describe, expect, it } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { cardIn, moveRoute, undoRoute } from '@/test/board-fixtures';
import { renderHookInApp } from '@/test/render-in-app';
import { server } from '@/test/server';

import { useMoveApplicationMutation } from './use-move-application-mutation';

const CARD = cardIn({ serial: 1, stage: 'applied', position: 'Senior Frontend Engineer' });

function renderMove() {
  return renderHookInApp(() => useMoveApplicationMutation()).result;
}

afterEach(() => {
  toast.dismiss();
});

describe('useMoveApplicationMutation', () => {
  it('a move says where the card went, and «Скасувати» sends one undo-last for that card', async () => {
    const undone = undoRoute();
    server.use(moveRoute().handler, undone.handler);
    const result = renderMove();

    act(() => {
      result.current.mutate({ application: CARD, toStage: 'screening' });
    });

    expect(await screen.findByText('Перенесено у «скринінг»')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Скасувати' }));
    await waitFor(() => {
      expect(undone.sent).toEqual([{ id: CARD.id, body: '' }]);
    });
  });

  it('a rejection sent with its reason leaves the undo to the reason dialog and shows no toast', async () => {
    server.use(moveRoute().handler);
    const result = renderMove();

    act(() => {
      result.current.mutate({ application: CARD, toStage: 'rejected', reasonCode: 'skills_gap' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(toast.getToasts()).toEqual([]);
  });

  it('a refused move shows only the reason it was refused, with no undo', async () => {
    server.use(moveRoute({ reply: () => errorReply({ status: 409, type: 'conflict' }) }).handler);
    const result = renderMove();

    act(() => {
      result.current.mutate({ application: CARD, toStage: 'screening' });
    });

    expect(await screen.findByText('Картка вже на іншому етапі')).toBeDefined();
    expect(screen.queryByText('Перенесено у «скринінг»')).toBeNull();
  });
});
