import type { ApplicationResponse } from '@jobflow/shared';
import { screen, within } from '@testing-library/react';
import type { RequestHandler } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { fixtureIdOf } from '@/test/board-fixtures';
import { noteRoute, notesRoute, sentNoteBodiesOf } from '@/test/note-fixtures';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';
import {
  answerAskedTopics,
  DESIGN_NOTE,
  DESIGN_TIMELINE,
  DESIGN_TIMELINE_APPLICATION,
  EMPTY_TIMELINE,
  interviewDoneOf,
  LONG_COMMENT,
  noteTimelineOf,
  timelineRoute,
} from '@/test/timeline-fixtures';

import { ApplicationTimeline } from './application-timeline';

type TimelineSetup = { route: RequestHandler; application?: ApplicationResponse };

const HEADING = 'Історія відгуку';

const CONTROL_ROLES = ['button', 'link', 'textbox'] as const;

const DESIGN_ROWS = [
  [
    'сьогодні',
    "Чекаєш на відповідь після техінтерв'ю",
    '4 дні тиші. Поріг фоллоу-апу: 7 днів, нагадаємо 10.09.',
  ],
  ['4 дні тому', 'Нотатка', DESIGN_NOTE],
  ['4 дні тому', "Техінтерв'ю пройдено · 90 хв"],
  ['28.08', "скринінг → техінтерв'ю", 'Перенесено вручну. 7 днів на етапі скринінгу.'],
  ['27.08', 'Фоллоу-ап надіслано'],
  ['21.08', 'відгук → скринінг', 'Перенесено вручну. 8 днів на етапі відгуку.'],
  [
    '20.08',
    '7 днів тиші · індикатор увімкнено',
    'Автоматична подія. Картка приглушилась на дошці.',
  ],
  ['13.08', 'Додано на етап «відгук»', 'Джерело: Djinni.'],
  ['12.08', 'Картку створено букмарклетом', 'AI розібрав опис за 6 секунд'],
] as const;

const TIMELINE_NOTE = { id: fixtureIdOf(401), createdAt: '2026-09-06T09:00:00Z' } as const;

const NOT_FOUND = () => errorReply({ status: 404, type: 'not_found' });

function renderTimeline({ route, application = DESIGN_TIMELINE_APPLICATION }: TimelineSetup) {
  server.use(meRoute({ silenceDays: 7, timezone: 'Europe/Kyiv' }), notesRoute().handler, route);
  const user = renderInApp(<ApplicationTimeline application={application} />);
  return { user, section: screen.getByRole('region', { name: HEADING }) };
}

const DESIGN_INTERVIEW_ID = fixtureIdOf(308);

const LATER_INTERVIEW = interviewDoneOf({ serial: 310, occurredAt: '2026-09-05T10:00:00Z' });

const QUESTION = { name: 'Що питали?' } as const;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-07T09:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('ApplicationTimeline after an interview', () => {
  it('asks «Що питали?» under the latest interview only, lands the answer saved by keyboard as a note and hands focus to the journal heading', async () => {
    const notes = noteRoute();
    server.use(notes.handler);
    const { user, section } = renderTimeline({
      route: timelineRoute({
        timeline: { items: [LATER_INTERVIEW, ...DESIGN_TIMELINE.items] },
      }),
    });

    const question = await within(section).findByRole('group', QUESTION);

    expect(within(section).getAllByRole('group', QUESTION)).toHaveLength(1);
    expect(question.closest('li')?.querySelector('time')?.textContent).toBe('позавчора');
    await user.click(within(question).getByRole('button', { name: 'Алгоритми' }));
    within(section).getByRole('button', { name: 'Зберегти' }).focus();
    await user.keyboard('{Enter}');
    await expect.poll(() => sentNoteBodiesOf(notes.sent)).toEqual(['Що питали: Алгоритми']);
    await expect
      .poll(() => document.activeElement)
      .toBe(within(section).getByRole('heading', { name: HEADING }));
  });

  it('«Пропустити» by keyboard hands focus to the journal heading, so the place is kept', async () => {
    const { user, section } = renderTimeline({ route: timelineRoute() });
    await within(section).findByRole('group', QUESTION);

    within(section).getByRole('button', { name: 'Пропустити' }).focus();
    await user.keyboard('{Enter}');

    expect(document.activeElement).toBe(within(section).getByRole('heading', { name: HEADING }));
  });

  it('an answered interview asks nothing', async () => {
    answerAskedTopics([DESIGN_INTERVIEW_ID]);
    const { section } = renderTimeline({ route: timelineRoute() });

    await within(section).findByRole('list');

    expect(within(section).queryByRole('group', QUESTION)).toBeNull();
  });
});

describe('ApplicationTimeline', () => {
  beforeEach(() => {
    answerAskedTopics([DESIGN_INTERVIEW_ID]);
  });

  it('shows the design journal: the waiting row on top, then every item newest first', async () => {
    const { section } = renderTimeline({ route: timelineRoute() });
    expect(section.getAttribute('aria-busy')).toBe('true');

    const list = await within(section).findByRole('list');

    expect(within(section).getByText('Історія · 9 подій')).toBeDefined();
    expect(within(section).getByRole('heading', { level: 2, name: HEADING })).toBeDefined();
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(DESIGN_ROWS.map((row) => row.join('')));
    expect(section.getAttribute('aria-busy')).toBeNull();
  });

  it('mutes the automatic silence row and offers no controls in the journal', async () => {
    const { section } = renderTimeline({ route: timelineRoute() });

    const silence = await within(section).findByText('7 днів тиші · індикатор увімкнено');

    expect(silence.classList).toContain('text-ink-2');
    expect(within(section).getByText('Фоллоу-ап надіслано').classList).not.toContain('text-ink-2');
    expect(CONTROL_ROLES.flatMap((role) => within(section).queryAllByRole(role))).toEqual([]);
  });

  it('keeps a long unbroken comment whole and lets its text column wrap it', async () => {
    renderTimeline({
      route: timelineRoute({ timeline: noteTimelineOf({ ...TIMELINE_NOTE, body: LONG_COMMENT }) }),
    });

    const comment = await screen.findByText(LONG_COMMENT);

    expect(comment.textContent).toHaveLength(1000);
    expect(comment.parentElement?.classList).toContain('min-w-0');
    expect(comment.parentElement?.classList).toContain('wrap-anywhere');
  });

  it('a note with **bold** shows no asterisks in the timeline', async () => {
    const { section } = renderTimeline({
      route: timelineRoute({
        timeline: noteTimelineOf({ ...TIMELINE_NOTE, body: 'Треба **повторити DP**' }),
      }),
    });

    const row = (await within(section).findByText('Нотатка')).closest('li');

    expect(row?.textContent).toContain('повторити DP');
    expect(row?.textContent).not.toContain('*');
  });

  it('a timeline that fails to load offers a retry inside the section that loads the journal', async () => {
    const { user, section } = renderTimeline({ route: timelineRoute({ reply: NOT_FOUND }) });
    const retry = await within(section).findByRole('button', { name: 'Спробувати ще раз' });
    server.use(timelineRoute());

    await user.click(retry);

    expect(await within(section).findByText('Історія · 9 подій')).toBeDefined();
    expect(within(section).getAllByRole('listitem')).toHaveLength(9);
  });

  it('an application with no events and nothing to wait for says the journal is empty', async () => {
    const { section } = renderTimeline({
      route: timelineRoute({ timeline: EMPTY_TIMELINE }),
      application: { ...DESIGN_TIMELINE_APPLICATION, currentStage: 'rejected' },
    });

    expect(await within(section).findByText('Подій ще немає')).toBeDefined();
    expect(within(section).getByText('Історія · 0 подій')).toBeDefined();
    expect(within(section).queryByRole('list')).toBeNull();
  });
});
