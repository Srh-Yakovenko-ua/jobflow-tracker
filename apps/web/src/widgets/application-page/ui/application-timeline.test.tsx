import type { ApplicationResponse } from '@jobflow/shared';
import { screen, within } from '@testing-library/react';
import type { RequestHandler } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { renderInApp } from '@/test/render-in-app';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';
import {
  DESIGN_NOTE,
  DESIGN_TIMELINE_APPLICATION,
  EMPTY_TIMELINE,
  LONG_COMMENT,
  timelineItemOf,
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
    '4 дні тиші. Поріг фоллоу-апу — 7 днів, нагадаємо 10.09.',
  ],
  ['4 дні тому', 'Заметка', DESIGN_NOTE],
  ['4 дні тому', "Техінтерв'ю пройдено · 90 хв"],
  ['28.08', "скринінг → техінтерв'ю", 'Перенесено вручну. 7 днів на етапі скринінгу.'],
  ['27.08', 'Фоллоу-ап надіслано'],
  ['21.08', 'відгук → скринінг', 'Перенесено вручну. 8 днів на етапі відгуку.'],
  [
    '20.08',
    '7 днів тиші · індикатор увімкнено',
    'Автоматична подія. Карточка приглушилась на дошці.',
  ],
  ['13.08', 'відгук надіслано', 'Через Djinni.'],
  ['12.08', 'Карточку створено букмарклетом', 'AI розібрав опис за 6 секунд'],
] as const;

const LONG_COMMENT_TIMELINE = {
  items: [
    timelineItemOf({
      serial: 401,
      type: 'note_added',
      occurredAt: '2026-09-06T09:00:00Z',
      title: 'Заметка',
      meta: { body: LONG_COMMENT },
    }),
  ],
};

const NOT_FOUND = () => errorReply({ status: 404, type: 'not_found' });

function renderTimeline({ route, application = DESIGN_TIMELINE_APPLICATION }: TimelineSetup) {
  server.use(meRoute({ silenceDays: 7, timezone: 'Europe/Kyiv' }), route);
  const user = renderInApp(<ApplicationTimeline application={application} />);
  return { user, section: screen.getByRole('region', { name: HEADING }) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-07T09:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ApplicationTimeline', () => {
  it('shows the design journal: the waiting row on top, then every item newest first', async () => {
    const { section } = renderTimeline({ route: timelineRoute() });
    expect(section.getAttribute('aria-busy')).toBe('true');

    const list = await within(section).findByRole('list');

    expect(within(section).getByText('Таймлайн · 9 подій')).toBeDefined();
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
    renderTimeline({ route: timelineRoute({ timeline: LONG_COMMENT_TIMELINE }) });

    const comment = await screen.findByText(LONG_COMMENT);

    expect(comment.textContent).toHaveLength(1000);
    expect(comment.parentElement?.classList).toContain('min-w-0');
    expect(comment.parentElement?.classList).toContain('wrap-anywhere');
  });

  it('a timeline that fails to load offers a retry inside the section that loads the journal', async () => {
    const { user, section } = renderTimeline({ route: timelineRoute({ reply: NOT_FOUND }) });
    const retry = await within(section).findByRole('button', { name: 'Спробувати ще раз' });
    server.use(timelineRoute());

    await user.click(retry);

    expect(await within(section).findByText('Таймлайн · 9 подій')).toBeDefined();
    expect(within(section).getAllByRole('listitem')).toHaveLength(9);
  });

  it('an application with no events and nothing to wait for says the journal is empty', async () => {
    const { section } = renderTimeline({
      route: timelineRoute({ timeline: EMPTY_TIMELINE }),
      application: { ...DESIGN_TIMELINE_APPLICATION, currentStage: 'rejected' },
    });

    expect(await within(section).findByText('Подій ще немає')).toBeDefined();
    expect(within(section).getByText('Таймлайн · 0 подій')).toBeDefined();
    expect(within(section).queryByRole('list')).toBeNull();
  });
});
