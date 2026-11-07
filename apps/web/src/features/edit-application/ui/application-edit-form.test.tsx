import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { errorReply, validationReply } from '@/test/api-handlers';
import { doubleClickWhileHeld } from '@/test/double-click-while-held';
import { descriptionOf } from '@/test/field-description';
import { latch } from '@/test/latch';
import { findApplicationTitle, renderApplicationPage } from '@/test/render-application-page';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

type User = ReturnType<typeof renderApplicationPage>['user'];

const SALARY = /^\$4\s500–6\s000$/;

const SALARY_ERROR = 'Ціле число від 0, не більше за суму «до»';

const POSITION_ERROR = 'Вкажи посаду одним коротким рядком';

const STAFF = 'Staff React Developer';

const SAVE = 'Зберегти';

const SAVE_FAILED_TOAST = 'Це збій на нашому боці, збережені дані на місці. Спробуй ще раз.';

const FIELDS_BANNER = 'Перевір поля й спробуй ще раз.';

async function editPosition(user: User): Promise<HTMLElement> {
  await user.click(await screen.findByRole('button', { name: 'Senior React Developer' }));
  return screen.getByRole('textbox', { name: 'Посада' });
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>('button', { name: SAVE });
}

async function findStaffTitle(): Promise<HTMLElement> {
  return screen.findByRole('heading', { level: 1, name: STAFF });
}

describe('ApplicationEditForm', () => {
  it.each([
    ['Senior React Developer', 'Посада'],
    ['Acme Technologies', 'Компанія'],
    [SALARY, 'Зарплата від'],
    ['Kyiv / гібрид', 'Локація'],
    ['GraphQL', 'Стек'],
  ])('a click on %s opens the editor focused on %s', async (shown, field) => {
    const { user } = renderApplicationPage();

    await user.click(await screen.findByRole('button', { name: shown }));

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: field }));
  });

  it('Escape puts the position back and sends nothing', async () => {
    const { user, updates } = renderApplicationPage();
    const position = await editPosition(user);

    await user.clear(position);
    await user.type(position, 'Staff Engineer');
    await user.keyboard('{Escape}');

    expect(await findApplicationTitle()).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Посада' })).toBeNull();
    expect(updates).toEqual([]);
  });

  it('Enter sends only the changed position and the title shows it', async () => {
    const { user, updates } = renderApplicationPage();
    const position = await editPosition(user);

    await user.clear(position);
    await user.type(position, `${STAFF}{Enter}`);

    expect(await findStaffTitle()).toBeDefined();
    expect(updates).toEqual([{ position: STAFF }]);
  });

  it('a double click while the first save is on its way sends one update and keeps Зберегти disabled', async () => {
    const held = latch();
    const { user, updates } = renderApplicationPage({ update: { latch: held } });
    const position = await editPosition(user);
    await user.clear(position);
    await user.type(position, STAFF);

    await doubleClickWhileHeld({
      user,
      held,
      click: SAVE,
      sent: updates,
      disabledWhileHeld: [SAVE],
    });

    expect(await findStaffTitle()).toBeDefined();
    expect(updates).toEqual([{ position: STAFF }]);
  });

  it('a save the server fails shows the save failed toast and keeps the editor open', async () => {
    const { user, updates } = renderApplicationPage({
      update: { reply: () => errorReply({ status: 500, type: 'internal_error' }) },
    });
    const position = await editPosition(user);

    await user.clear(position);
    await user.type(position, `${STAFF}{Enter}`);

    expect(await screen.findByText(SAVE_FAILED_TOAST)).toBeDefined();
    expect(screen.queryByText(FIELDS_BANNER)).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Посада' })).toBe(position);
    expect(updates).toEqual([{ position: STAFF }]);
  });

  it('a position fixed after its blur error loses the error while typing, and one click on Зберегти saves it', async () => {
    const { user, updates } = renderApplicationPage();
    const position = await editPosition(user);
    await user.clear(position);
    await user.tab();
    await waitFor(() => {
      expect(descriptionOf(position)).toBe(POSITION_ERROR);
    });

    await user.type(position, STAFF);
    await waitFor(() => {
      expect(descriptionOf(position)).toBeUndefined();
    });
    await user.click(saveButton());

    expect(await findStaffTitle()).toBeDefined();
    expect(updates).toEqual([{ position: STAFF }]);
  });

  it('a 422 on salaryMin shows under that field and keeps the editor open', async () => {
    const { user, updates } = renderApplicationPage({
      update: {
        reply: () =>
          validationReply([
            { path: 'salaryMin', message: 'salaryMin must not be greater than salaryMax' },
          ]),
      },
    });
    await user.click(await screen.findByRole('button', { name: SALARY }));
    const salaryMin = screen.getByRole('textbox', { name: 'Зарплата від' });

    await user.clear(salaryMin);
    await user.type(salaryMin, '4800{Enter}');

    await waitFor(() => {
      expect(descriptionOf(salaryMin)).toBe(SALARY_ERROR);
    });
    expect(updates).toEqual([{ salaryMin: 4800, salaryMax: 6000 }]);
  });

  it('a cleared position is refused before anything is sent', async () => {
    const { user, updates } = renderApplicationPage();
    const position = await editPosition(user);

    await user.clear(position);
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(descriptionOf(position)).toBe(POSITION_ERROR);
    });
    expect(updates).toEqual([]);
  });

  it('Редагувати from the menu focuses the position, and an unchanged save sends nothing', async () => {
    const { user, updates } = renderApplicationPage();

    (await screen.findByRole('button', { name: 'Ще дії' })).focus();
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitem', { name: 'Редагувати' }));
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Посада' }));
    });
    await user.keyboard('{Enter}');

    expect(await findApplicationTitle()).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Посада' })).toBeNull();
    expect(updates).toEqual([]);
  });
});
