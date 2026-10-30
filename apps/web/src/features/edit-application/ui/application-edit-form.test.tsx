import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { findApplicationTitle, renderApplicationPage } from '@/test/render-application-page';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

type User = ReturnType<typeof renderApplicationPage>['user'];

const SALARY = /^\$4\s500–6\s000$/;

const SALARY_ERROR = 'Ціле число від 0, не більше за суму «до»';

async function editPosition(user: User): Promise<HTMLElement> {
  await user.click(await screen.findByRole('button', { name: 'Senior React Developer' }));
  return screen.getByRole('textbox', { name: 'Посада' });
}

function descriptionOf(control: HTMLElement): string | null | undefined {
  const describedBy = control.getAttribute('aria-describedby') ?? '';
  return document.getElementById(describedBy)?.textContent;
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
    await user.type(position, 'Staff React Developer{Enter}');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Staff React Developer' }),
    ).toBeDefined();
    expect(updates).toEqual([{ position: 'Staff React Developer' }]);
  });

  it('a 422 on salaryMin shows under that field and keeps the editor open', async () => {
    const { user, updates } = renderApplicationPage({
      update: {
        reply: () =>
          errorReply({
            status: 422,
            type: 'validation_error',
            errors: [
              { path: 'salaryMin', message: 'salaryMin must not be greater than salaryMax' },
            ],
          }),
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
      expect(descriptionOf(position)).toBe('Вкажи посаду одним коротким рядком');
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
