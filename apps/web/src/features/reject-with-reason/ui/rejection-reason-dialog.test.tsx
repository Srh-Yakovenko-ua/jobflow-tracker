import type { RejectionReasonCode } from '@jobflow/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';
import { cardIn } from '@/test/board-fixtures';

import { RejectionReasonDialog, type RejectionReasonDialogProps } from './rejection-reason-dialog';

const MOVE = {
  application: {
    ...cardIn({ serial: 1, stage: 'tech_interview', position: 'Senior Frontend Engineer' }),
    company: 'Acme Technologies',
  },
};

function renderDialog(move: RejectionReasonDialogProps['move'] = MOVE) {
  const picked: RejectionReasonCode[] = [];
  const cancelled: string[] = [];
  render(
    <RejectionReasonDialog
      move={move}
      onPick={(reasonCode) => picked.push(reasonCode)}
      onCancel={() => cancelled.push('cancel')}
    />,
  );
  return { user: userEvent.setup(), picked, cancelled };
}

function reasonsIn(group: string): string[] {
  return within(screen.getByRole('group', { name: group }))
    .getAllByRole('button')
    .map((button) => button.textContent);
}

describe('RejectionReasonDialog', () => {
  it('names the company and the move, then lists what the company and what I refused for', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Що сталося?' });
    expect(within(dialog).getByText("Acme Technologies · техінтерв'ю → відмова")).toBeDefined();
    expect(within(dialog).getByText(uk.board.reject.description)).toBeDefined();
    expect(reasonsIn('Відмовила компанія')).toEqual([
      'не вистачає скілів',
      'рівень англійської',
      'зарплатні очікування',
      'обрали іншого',
      'вакансію закрили',
      'без пояснення',
    ]);
    expect(reasonsIn('Відмовився я')).toEqual([
      'низька вилка',
      'офіс/графік',
      'ред флаги',
      'прийняв інший офер',
    ]);
  });

  it('a reason click picks its code and nothing is cancelled', async () => {
    const { user, picked, cancelled } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'не вистачає скілів' }));

    expect(picked).toEqual(['skills_gap']);
    expect(cancelled).toEqual([]);
  });

  it('"Не хочу зараз вказувати" picks unspecified', async () => {
    const { user, picked } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Не хочу зараз вказувати' }));

    expect(picked).toEqual(['unspecified']);
  });

  it.each([
    {
      name: 'Escape',
      act: (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}'),
    },
    {
      name: 'the close button',
      act: (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: uk.app.close })),
    },
  ])('$name cancels and picks no reason', async ({ act }) => {
    const { user, picked, cancelled } = renderDialog();

    await act(user);

    expect(cancelled).toEqual(['cancel']);
    expect(picked).toEqual([]);
  });

  it('with no move pending shows no dialog', () => {
    renderDialog(null);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
