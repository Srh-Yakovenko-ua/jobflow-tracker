import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { fixtureIdOf, type MoveRouteOptions } from '@/test/board-fixtures';
import { noteRoute, sentNoteBodiesOf } from '@/test/note-fixtures';
import { renderViewInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { ME_RESPONSE, meRoute } from '@/test/session-fixtures';

import { AskedTopicsQuestion } from './asked-topics-question';

const QUESTION = { name: 'Що питали?' } as const;

const ASKED_KEY = `jobflow.asked-topics.${ME_RESPONSE.user.id}`;

const INTERVIEW_ID = fixtureIdOf(308);

const LATER_INTERVIEW_ID = fixtureIdOf(310);

afterEach(() => {
  localStorage.clear();
});

const SAVE_FAILED = () => errorReply({ status: 500, type: 'internal_error' });

function renderQuestions(itemIds: readonly string[] = [INTERVIEW_ID], control?: MoveRouteOptions) {
  const route = noteRoute(control);
  server.use(meRoute(), route.handler);
  const { user, view } = renderViewInApp(
    <>
      {itemIds.map((itemId) => (
        <section key={itemId} aria-label={itemId}>
          <AskedTopicsQuestion
            application={ACME_APPLICATION}
            itemId={itemId}
            actions={{ onClosed: vi.fn() }}
          />
        </section>
      ))}
    </>,
  );
  return { user, view, sent: route.sent };
}

describe('AskedTopicsQuestion', () => {
  it('asks what came up and saves the picked topics as a note, then stops asking', async () => {
    const { user, sent } = renderQuestions();
    const question = await screen.findByRole('group', QUESTION);
    const save = screen.getByRole('button', { name: 'Зберегти' });

    expect(save.hasAttribute('disabled')).toBe(true);
    await user.click(within(question).getByRole('button', { name: 'SQL' }));
    await user.click(within(question).getByRole('button', { name: 'Алгоритми' }));
    await user.click(save);

    await expect.poll(() => sentNoteBodiesOf(sent)).toEqual(['Що питали: Алгоритми, SQL']);
    expect(sent[0]?.id).toBe(ACME_APPLICATION.id);
    expect(sent[0]?.idempotencyKey).toMatch(/^[\da-f-]{36}$/);
    await waitFor(() => {
      expect(screen.queryByRole('group', QUESTION)).toBeNull();
    });
    expect(JSON.parse(localStorage.getItem(ASKED_KEY) ?? '')).toEqual([INTERVIEW_ID]);
  });

  it('a failed save shows the error toast, keeps the question open and retries with the same key', async () => {
    const { user, sent } = renderQuestions([INTERVIEW_ID], { reply: SAVE_FAILED });
    const question = await screen.findByRole('group', QUESTION);
    await user.click(within(question).getByRole('button', { name: 'SQL' }));
    const save = screen.getByRole('button', { name: 'Зберегти' });

    await user.click(save);

    expect(await screen.findByText('Не вдалося зберегти')).toBeDefined();
    expect(screen.getByRole('group', QUESTION)).toBeDefined();
    expect(localStorage.getItem(ASKED_KEY)).toBeNull();
    const retry = noteRoute();
    server.use(retry.handler);
    await user.click(save);
    await waitFor(() => {
      expect(screen.queryByRole('group', QUESTION)).toBeNull();
    });
    expect(sentNoteBodiesOf(retry.sent)).toEqual(['Що питали: SQL']);
    expect(retry.sent[0]?.idempotencyKey).toMatch(/^[\da-f-]{36}$/);
    expect(retry.sent[0]?.idempotencyKey).toBe(sent[0]?.idempotencyKey);
  });

  it('offers the 8 note topics analytics reads, none picked yet', async () => {
    renderQuestions();

    const question = await screen.findByRole('group', QUESTION);

    expect(
      within(question)
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual([
      'Алгоритми',
      'Динамічне програмування',
      'System design',
      'Англійська',
      'Тестове завдання',
      'React internals',
      'SQL',
      'Поведінкові питання',
    ]);
    expect(within(question).queryAllByRole('button', { pressed: true })).toEqual([]);
  });

  it('«Пропустити» hides the question, and it stays hidden when the card opens again', async () => {
    const { user, view } = renderQuestions();
    await screen.findByRole('group', QUESTION);

    await user.click(screen.getByRole('button', { name: 'Пропустити' }));
    await waitFor(() => {
      expect(screen.queryByRole('group', QUESTION)).toBeNull();
    });
    view.unmount();
    renderQuestions([INTERVIEW_ID, LATER_INTERVIEW_ID]);

    const later = screen.getByRole('region', { name: LATER_INTERVIEW_ID });
    expect(await within(later).findByRole('group', QUESTION)).toBeDefined();
    expect(
      within(screen.getByRole('region', { name: INTERVIEW_ID })).queryByRole('group', QUESTION),
    ).toBeNull();
  });

  it('works by keyboard alone: Space picks a topic and Enter on «Зберегти» saves it', async () => {
    const { user, sent } = renderQuestions();
    const question = await screen.findByRole('group', QUESTION);

    await user.tab();
    const first = within(question).getByRole('button', { name: 'Алгоритми' });
    expect(document.activeElement).toBe(first);
    await user.keyboard(' ');
    expect(first.getAttribute('aria-pressed')).toBe('true');
    screen.getByRole('button', { name: 'Зберегти' }).focus();
    await user.keyboard('{Enter}');

    await expect.poll(() => sentNoteBodiesOf(sent)).toEqual(['Що питали: Алгоритми']);
  });
});
