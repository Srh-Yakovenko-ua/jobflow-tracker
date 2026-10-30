import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';
import { ACME_TECH_INTERVIEW, recordedRejectionActions } from '@/test/rejection-fixtures';

import { rememberLastReason } from '../lib/last-reason';
import type { RejectionPrompt, RejectionStep } from '../model/rejection-step';
import { RejectionReasonDialog } from './rejection-reason-dialog';

type User = ReturnType<typeof userEvent.setup>;

function promptAt(step: RejectionStep = { kind: 'choose' }): RejectionPrompt {
  return { application: ACME_TECH_INTERVIEW, step };
}

function renderDialog(prompt: RejectionPrompt | null = promptAt()) {
  const { actions, ...recorded } = recordedRejectionActions();
  render(<RejectionReasonDialog prompt={prompt} actions={actions} />);
  return { user: userEvent.setup(), ...recorded };
}

function reasonsIn(group: string): string[] {
  return within(screen.getByRole('group', { name: group }))
    .getAllByRole('button')
    .map((button) => button.textContent);
}

function shortcutsIn(group: string): (string | null)[] {
  return within(screen.getByRole('group', { name: group }))
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-keyshortcuts'));
}

afterEach(() => {
  localStorage.clear();
});

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

  it('company reasons are written in clay and mine in lavender, not in the neutral button ink', () => {
    renderDialog();

    const classesOf = (name: string) => screen.getByRole('button', { name }).classList;
    expect(classesOf('не вистачає скілів')).toContain(
      'text-[color:color-mix(in_oklab,var(--color-rejected)_55%,var(--color-ink))]',
    );
    expect(classesOf('низька вилка')).toContain(
      'text-[color:color-mix(in_oklab,var(--color-withdrawn)_55%,var(--color-ink))]',
    );
    expect(classesOf('не вистачає скілів')).not.toContain('text-ink');
    expect(classesOf('низька вилка')).not.toContain('text-ink');
  });

  it('opens with the dialog itself focused, each reason announces its digit, and the footer names the keys', () => {
    renderDialog();

    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    expect(shortcutsIn('Відмовила компанія')).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(shortcutsIn('Відмовився я')).toEqual(['7', '8', '9', '0']);
    expect(screen.getByText('ENTER — остання причина · ESC — скасувати')).toBeDefined();
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
    { key: '3', reason: 'salary_expectations' },
    { key: '0', reason: 'accepted_other' },
  ])('key $key picks $reason', async ({ key, reason }) => {
    const { user, picked, cancelled } = renderDialog();

    await user.keyboard(key);

    expect(picked).toEqual([reason]);
    expect(cancelled).toEqual([]);
  });

  it('a digit typed with Control held picks nothing', async () => {
    const { user, picked } = renderDialog();

    await user.keyboard('{Control>}3{/Control}');

    expect(picked).toEqual([]);
  });

  it('ENTER with no reason used before picks nothing and keeps the dialog open', async () => {
    const { user, picked, cancelled } = renderDialog();

    await user.keyboard('{Enter}');

    expect(picked).toEqual([]);
    expect(cancelled).toEqual([]);
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('ENTER repeats the reason used last', async () => {
    rememberLastReason('chose_other');
    const { user, picked } = renderDialog();

    await user.keyboard('{Enter}');

    expect(picked).toEqual(['chose_other']);
  });

  it('ENTER on a focused «обрали іншого» picks that chip, not the reason used last', async () => {
    rememberLastReason('skills_gap');
    const { user, picked } = renderDialog();

    screen.getByRole('button', { name: 'обрали іншого' }).focus();
    await user.keyboard('{Enter}');

    expect(picked).toEqual(['chose_other']);
  });

  it.each([
    {
      name: 'Escape',
      act: (user: User) => user.keyboard('{Escape}'),
    },
    {
      name: 'the close button',
      act: (user: User) => user.click(screen.getByRole('button', { name: uk.app.close })),
    },
  ])('$name cancels and picks no reason', async ({ act }) => {
    const { user, picked, cancelled } = renderDialog();

    await act(user);

    expect(cancelled).toEqual(['cancel']);
    expect(picked).toEqual([]);
  });

  it('while the move is saving the chips stay, a digit picks nothing, and Escape keeps the move', async () => {
    rememberLastReason('chose_other');
    const { user, picked, cancelled, finished } = renderDialog(
      promptAt({ kind: 'saving', reasonCode: 'skills_gap' }),
    );

    expect(reasonsIn('Відмовила компанія')).toHaveLength(6);
    await user.keyboard('3');
    await user.keyboard('{Enter}');
    await user.keyboard('{Escape}');

    expect(picked).toEqual([]);
    expect(cancelled).toEqual([]);
    expect(finished).toEqual(['done']);
  });

  it('with no move pending shows no dialog', () => {
    renderDialog(null);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
