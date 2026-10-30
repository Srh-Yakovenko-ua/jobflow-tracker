import type { Stage } from '@jobflow/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ACME_APPLICATION } from '@/test/application-fixtures';
import { back, replace } from '@/test/navigation';
import { findApplicationTitle, renderApplicationPage } from '@/test/render-application-page';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

afterEach(() => {
  back.mockClear();
  replace.mockClear();
});

const SETTLED_STAGES: readonly Stage[] = ['offer', 'rejected', 'ghosted', 'withdrawn'];

describe('ApplicationActions', () => {
  it('the primary moves the application to the next stage once and the chip follows', async () => {
    const { user, moves } = renderApplicationPage();

    await user.click(await screen.findByRole('button', { name: 'Перенести у «фінал»' }));

    expect(await screen.findByText('фінал')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Перенести у «офер»' })).toBeDefined();
    expect(moves).toEqual([{ fromStage: 'tech_interview', toStage: 'final' }]);
  });

  it('Відмова asks the reason, records it, and the undo returns focus to the title', async () => {
    const { user, moves, undone } = renderApplicationPage();

    await user.click(await screen.findByRole('button', { name: 'Відмова' }));
    await screen.findByRole('dialog', { name: 'Що сталося?' });
    await user.click(screen.getByRole('button', { name: 'не вистачає скілів' }));
    expect(await screen.findByText('записано в аналітику')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Скасувати перенос' }));

    const heading = await findApplicationTitle();
    await waitFor(() => {
      expect(document.activeElement).toBe(heading);
    });
    expect(moves).toEqual([
      { fromStage: 'tech_interview', toStage: 'rejected', reasonCode: 'skills_gap' },
    ]);
    expect(undone).toEqual([{ id: ACME_APPLICATION.id, body: '' }]);
  });

  it.each(SETTLED_STAGES)(
    'an application in %s offers neither a next stage nor Відмова',
    async (stage) => {
      renderApplicationPage({ application: { ...ACME_APPLICATION, currentStage: stage } });

      await findApplicationTitle();
      expect(screen.queryByRole('button', { name: /^Перенести у/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Відмова' })).toBeNull();
    },
  );

  it('opens the vacancy link in a new tab without handing it the page', async () => {
    renderApplicationPage();

    const link = await screen.findByRole('link', { name: 'Відкрити вакансію' });
    expect(link.getAttribute('href')).toBe('https://jobs.example.com/acme/senior-react');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it.each([null, 'javascript:alert(1)', 'ftp://jobs.example.com/1'])(
    'has no vacancy link when the url is %s',
    async (url) => {
      renderApplicationPage({ application: { ...ACME_APPLICATION, url } });

      await findApplicationTitle();
      expect(screen.queryByRole('link', { name: 'Відкрити вакансію' })).toBeNull();
    },
  );

  it.each([
    { mode: 'page', left: replace, to: ['/board'] },
    { mode: 'sheet', left: back, to: [] },
  ] as const)(
    'Видалити in the $mode asks first, deletes once and leaves for the board',
    async ({ mode, left, to }) => {
      const { user, deletes } = renderApplicationPage({ mode });

      await user.click(await screen.findByRole('button', { name: 'Ще дії' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Видалити' }));
      const dialog = await screen.findByRole('dialog', { name: 'Видалити картку?' });
      await user.click(within(dialog).getByRole('button', { name: 'Видалити' }));

      await waitFor(() => {
        expect(left).toHaveBeenCalledWith(...to);
      });
      expect(deletes).toEqual([ACME_APPLICATION.id]);
    },
  );

  it('Скасувати in the delete dialog sends nothing and returns focus to the title', async () => {
    const { user, deletes } = renderApplicationPage();

    await user.click(await screen.findByRole('button', { name: 'Ще дії' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Видалити' }));
    await user.click(await screen.findByRole('button', { name: 'Скасувати' }));

    const heading = await findApplicationTitle();
    await waitFor(() => {
      expect(document.activeElement).toBe(heading);
    });
    expect(screen.queryByRole('dialog', { name: 'Видалити картку?' })).toBeNull();
    expect(deletes).toEqual([]);
  });

  it('Enter on Ще дії opens the menu with Редагувати and Видалити', async () => {
    const { user } = renderApplicationPage();

    (await screen.findByRole('button', { name: 'Ще дії' })).focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('menuitem', { name: 'Редагувати' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Видалити' })).toBeDefined();
  });
});
