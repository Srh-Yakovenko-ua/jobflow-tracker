import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { chipNames, CHIPS_NAME, pickInPill } from '@/test/board-filters';
import { DESIGN_BOARD } from '@/test/board-fixtures';
import { renderBoard } from '@/test/render-board';
import { buildResumeVersion, resumeVersionIdOf, resumeVersionsRoute } from '@/test/resume-fixtures';
import { server } from '@/test/server';

vi.mock('next/link', () => import('@/test/link'));
vi.mock('next/navigation', () => import('@/test/navigation'));

const V2_ID = resumeVersionIdOf(2);

const VERSIONS = [
  buildResumeVersion({
    id: resumeVersionIdOf(3),
    number: 3,
    title: 'без відгуків',
    isArchived: true,
    applicationsCount: 0,
  }),
  buildResumeVersion({ id: V2_ID, number: 2, title: 'акцент на продукті' }),
  buildResumeVersion({
    id: resumeVersionIdOf(1),
    number: 1,
    title: 'хронологія',
    isArchived: true,
    applicationsCount: 4,
  }),
];

const V2_LABEL = 'CV v2 · акцент на продукті';

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('KanbanBoard filter by CV version', () => {
  it('picking a version writes the URL, names the pill and adds a chip, and removing the chip takes all three back', async () => {
    server.use(resumeVersionsRoute(VERSIONS));
    const { user, sent } = renderBoard(DESIGN_BOARD);
    await user.click(await screen.findByRole('button', { name: 'CV: усі' }));

    expect(
      await screen.findByRole('checkbox', { name: 'CV v1 · хронологія · в архіві' }),
    ).toBeDefined();
    expect(screen.queryByRole('checkbox', { name: /CV v3/ })).toBeNull();
    await user.keyboard('{Escape}');
    await pickInPill(user, { pill: 'CV: усі', option: V2_LABEL });

    expect(window.location.search).toBe(`?resumeVersion=${V2_ID}`);
    expect(screen.getByRole('button', { name: 'CV v2' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Фільтри' })).toBeDefined();
    expect(chipNames()).toEqual([V2_LABEL]);
    await waitFor(() => {
      expect(sent).toEqual(['', `resumeVersion=${V2_ID}`]);
    });

    await user.click(screen.getByRole('button', { name: `Прибрати ${V2_LABEL}` }));

    expect(window.location.search).toBe('');
    expect(screen.queryByRole('list', { name: CHIPS_NAME })).toBeNull();
    expect(screen.getByRole('button', { name: 'CV: усі' })).toBeDefined();
  });

  it('a reload with a version in the URL asks for it again and shows its pill and chip', async () => {
    server.use(resumeVersionsRoute(VERSIONS));
    const { sent } = renderBoard(DESIGN_BOARD, { url: `/board?resumeVersion=${V2_ID}` });

    expect(await screen.findByRole('button', { name: 'CV v2' })).toBeDefined();
    expect(chipNames()).toEqual([V2_LABEL]);
    await waitFor(() => {
      expect(sent).toContain(`resumeVersion=${V2_ID}`);
    });
  });

  it('a version list that fails to load says so in the popover, keeps the board and retries', async () => {
    server.use(resumeVersionsRoute(() => errorReply({ status: 500, type: 'internal_error' })));
    const { user } = renderBoard(DESIGN_BOARD);
    await user.click(await screen.findByRole('button', { name: 'CV: усі' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Не вдалося завантажити');
    expect(screen.getByRole('heading', { name: 'відгук 2' })).toBeDefined();
    server.use(resumeVersionsRoute(VERSIONS));
    await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));

    expect(await screen.findByRole('checkbox', { name: V2_LABEL })).toBeDefined();
  });

  it('a user with no CV version yet reads a note in the popover instead of an empty list', async () => {
    const { user } = renderBoard(DESIGN_BOARD);
    await user.click(await screen.findByRole('button', { name: 'CV: усі' }));

    expect(await screen.findByText('Ще немає жодної версії CV')).toBeDefined();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
