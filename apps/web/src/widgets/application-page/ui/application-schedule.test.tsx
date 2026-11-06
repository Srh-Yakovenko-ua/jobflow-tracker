import { act, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_CLIENT_LIMITS, clearAccessToken, setAccessToken } from '@/shared/api';
import { errorReply, OUTAGES, SESSION_TOKENS } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { type BoardRouteOptions, cardIn } from '@/test/board-fixtures';
import { stubFileDownload } from '@/test/file-download';
import { latch } from '@/test/latch';
import { findApplicationTitle, renderApplicationPage } from '@/test/render-application-page';
import {
  dateTrigger,
  findScheduleDialog,
  KYIV_TOMORROW,
  openScheduleDialog,
  pickToday,
  pinScheduleClock,
  pinScheduleClockWithTimeouts,
  typeTime,
  waitForDate,
} from '@/test/schedule-dialog';
import {
  SCHEDULED_EVENT_ICS,
  scheduledEventOf,
  scheduledEventsRoute,
} from '@/test/scheduled-event-fixtures';
import { server } from '@/test/server';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const ACME_BOARD: BoardRouteOptions = {
  counts: { tech_interview: 1 },
  cards: [cardIn({ serial: 201, stage: 'tech_interview', position: ACME_APPLICATION.position })],
};

const PAST_EVENT = scheduledEventOf({ startsAt: '2026-11-06T14:00:00Z' });

const MEET_LINK = 'https://meet.example.com/acme';

const UPCOMING_EVENT = scheduledEventOf({
  startsAt: '2026-11-09T07:00:00Z',
  locationOrLink: MEET_LINK,
});

const CALL_TODAY = 'дзвінок сьогодні, 16:00';

const SCHEDULE_TITLE = 'Запланувати подію';

function outcomePrompt() {
  return within(screen.getByRole('region', { name: 'Як пройшло?' }));
}

async function answer({ user, outcome }: { user: UserEvent; outcome: string }) {
  await screen.findByRole('region', { name: 'Як пройшло?' });
  await user.click(outcomePrompt().getByRole('button', { name: outcome }));
}

async function completeWithSuggestion() {
  const page = renderApplicationPage({
    scheduledEvents: { items: [PAST_EVENT], update: { suggestedStage: 'final' } },
  });
  await answer({ user: page.user, outcome: 'Пройдено' });
  const suggestion = within(await screen.findByRole('group', { name: 'Записано в історію' }));
  return { ...page, suggestion };
}

async function waitForDialogGone(): Promise<void> {
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: SCHEDULE_TITLE })).toBeNull();
  });
}

beforeEach(pinScheduleClock);

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
  vi.restoreAllMocks();
  clearAccessToken();
});

describe('ApplicationSchedule', () => {
  it('a call planned for today at 16:00 reaches the board card and the sheet header without a remount', async () => {
    const { user, scheduledEvents, board } = renderApplicationPage({
      mode: 'sheet',
      board: ACME_BOARD,
    });
    const title = await findApplicationTitle();
    const dialog = await openScheduleDialog(user);
    await user.click(dialog.getByRole('combobox', { name: 'Тип' }));
    await user.click(await screen.findByRole('option', { name: 'Скринінг' }));
    await pickToday(user);
    await typeTime({ user, time: '16:00' });
    const boardLoads = board.length;

    await user.click(dialog.getByRole('button', { name: 'Запланувати' }));

    await waitFor(() => {
      expect(screen.getAllByText(CALL_TODAY)).toHaveLength(2);
    });
    expect(scheduledEvents.created).toEqual([
      {
        id: ACME_APPLICATION.id,
        body: {
          kind: 'screening_call',
          startsAt: '2026-11-07T14:00:00.000Z',
          durationMin: 60,
          locationOrLink: null,
        },
      },
    ]);
    expect(boardLoads).toBe(1);
    expect(board).toHaveLength(2);
    expect(screen.getAllByText(CALL_TODAY).filter((chip) => chip.closest('article'))).toHaveLength(
      1,
    );
    expect(await findApplicationTitle()).toBe(title);
    await waitForDialogGone();
  });

  it('a double click on Запланувати while the save is held sends one POST', async () => {
    const held = latch();
    const { user, scheduledEvents } = renderApplicationPage({
      scheduledEvents: { create: { latch: held } },
    });
    const dialog = await openScheduleDialog(user);
    const submit = dialog.getByRole('button', { name: 'Запланувати' });

    await user.dblClick(submit);
    await waitFor(() => {
      expect(submit.getAttribute('aria-busy')).toBe('true');
    });
    held.release();

    await waitForDialogGone();
    expect(scheduledEvents.created).toHaveLength(1);
  });

  it.each(OUTAGES)(
    'when the save $name the dialog keeps what was typed and says the save failed',
    async ({ reply, settled }) => {
      pinScheduleClockWithTimeouts();
      const { user, scheduledEvents } = renderApplicationPage({
        scheduledEvents: { create: { reply } },
      });
      const dialog = await openScheduleDialog(user);
      await typeTime({ user, time: '16:00' });

      await user.click(dialog.getByRole('button', { name: 'Запланувати' }));
      if (settled === 'pending') {
        await act(() => vi.advanceTimersByTimeAsync(API_CLIENT_LIMITS.requestTimeoutMs));
      }

      expect(await screen.findByText('Не вдалося зберегти')).toBeDefined();
      expect(dialog.getByLabelText<HTMLInputElement>('Час').value).toBe('16:00');
      expect(dateTrigger().textContent).toBe(KYIV_TOMORROW);
      expect(dialog.getByRole('button', { name: 'Запланувати' }).hasAttribute('disabled')).toBe(
        false,
      );
      expect(scheduledEvents.created).toHaveLength(1);
    },
  );

  it('an event list that fails to load offers a retry and then shows the plan', async () => {
    const { user } = renderApplicationPage({
      scheduledEvents: { list: { reply: () => errorReply({ status: 404, type: 'not_found' }) } },
    });
    const retry = await screen.findByRole('button', { name: 'Спробувати ще раз' });
    server.use(scheduledEventsRoute({ store: [PAST_EVENT] }).handler);

    await user.click(retry);

    expect(await screen.findByRole('region', { name: 'Як пройшло?' })).toBeDefined();
  });

  it('an event list still on its way shows neither a prompt nor a retry', async () => {
    const held = latch();
    renderApplicationPage({ scheduledEvents: { items: [PAST_EVENT], list: { latch: held } } });

    await findApplicationTitle();

    expect(screen.queryByRole('region', { name: 'Як пройшло?' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Спробувати ще раз' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Запланувати' })).toBeDefined();
  });

  it('Пройдено records the event, then the suggested stage is one press away', async () => {
    const { user, scheduledEvents, moves, suggestion } = await completeWithSuggestion();
    const offered = suggestion.getByRole('button', { name: 'Перенести у «фінал»' });

    expect(screen.getAllByRole('button', { name: 'Перенести у «фінал»' })).toEqual([offered]);
    await user.click(offered);

    await waitFor(() => {
      expect(screen.queryByRole('group', { name: 'Записано в історію' })).toBeNull();
    });
    expect(scheduledEvents.updated).toEqual([
      { itemId: PAST_EVENT.id, body: { status: 'done', durationMin: 60 } },
    ]);
    expect(moves).toEqual([{ fromStage: 'tech_interview', toStage: 'final' }]);
    expect(screen.queryByRole('region', { name: 'Як пройшло?' })).toBeNull();
  });

  it('Не зараз drops the suggestion, gives the move back to the header and moves nothing', async () => {
    const { user, moves, suggestion } = await completeWithSuggestion();

    await user.click(suggestion.getByRole('button', { name: 'Не зараз' }));

    expect(screen.queryByRole('group', { name: 'Записано в історію' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Перенести у «фінал»' })).toHaveLength(1);
    expect(moves).toEqual([]);
  });

  it('Перенесли opens the event as planned and sends the new start', async () => {
    const { user, scheduledEvents } = renderApplicationPage({
      scheduledEvents: { items: [PAST_EVENT] },
    });

    await answer({ user, outcome: 'Перенесли' });
    const dialog = await findScheduleDialog('Перенести подію');
    await waitForDate('06.11.2026');
    await pickToday(user);
    await typeTime({ user, time: '18:30' });
    await user.click(dialog.getByRole('button', { name: 'Перенести' }));

    expect(await screen.findByText("техінтерв'ю сьогодні, 18:30")).toBeDefined();
    expect(scheduledEvents.updated.map(({ body }) => body.startsAt)).toEqual([
      '2026-11-07T16:30:00.000Z',
    ]);
    expect(screen.queryByRole('region', { name: 'Як пройшло?' })).toBeNull();
  });

  it('Скасували sends the cancelled status, closes the prompt and suggests nothing', async () => {
    const { user, scheduledEvents } = renderApplicationPage({
      scheduledEvents: { items: [PAST_EVENT], update: { suggestedStage: 'final' } },
    });

    await answer({ user, outcome: 'Скасували' });

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Як пройшло?' })).toBeNull();
    });
    expect(scheduledEvents.updated).toEqual([
      { itemId: PAST_EVENT.id, body: { status: 'cancelled' } },
    ]);
    expect(screen.queryByRole('group', { name: 'Записано в історію' })).toBeNull();
  });

  it('a 409 on the answer says the event changed and reloads the list', async () => {
    const { user, scheduledEvents } = renderApplicationPage({
      scheduledEvents: {
        items: [PAST_EVENT],
        update: { reply: () => errorReply({ status: 409, type: 'conflict' }) },
      },
    });

    await answer({ user, outcome: 'Пройдено' });

    expect(await screen.findByText('Подію вже змінено')).toBeDefined();
    await waitFor(() => {
      expect(scheduledEvents.listed).toHaveLength(2);
    });
  });

  it('Завантажити .ics fetches the file with the session and saves it as jobflow-event.ics', async () => {
    setAccessToken(SESSION_TOKENS.fresh);
    const download = stubFileDownload();
    const { user, scheduledEvents } = renderApplicationPage({
      scheduledEvents: { items: [UPCOMING_EVENT] },
    });

    await user.click(await screen.findByRole('button', { name: 'Завантажити .ics' }));

    await vi.waitFor(() => {
      expect(download.revoked()).toHaveLength(1);
    });
    const [blob] = download.blobs();
    expect(blob?.type).toBe('text/calendar');
    expect(await blob?.text()).toBe(SCHEDULED_EVENT_ICS);
    expect(download.anchors().map((anchor) => anchor.download)).toEqual(['jobflow-event.ics']);
    expect(scheduledEvents.downloaded).toEqual([
      {
        eventId: UPCOMING_EVENT.id,
        authorization: `Bearer ${SESSION_TOKENS.fresh}`,
        accept: 'text/calendar',
      },
    ]);
  });

  it.each([
    { location: MEET_LINK, href: MEET_LINK },
    { location: 'javascript:alert(1)', href: null },
    { location: 'Київ, вул. Хрещатик, 1', href: null },
  ])('the place $location is a link only when it is a web address', async ({ location, href }) => {
    renderApplicationPage({
      scheduledEvents: { items: [{ ...UPCOMING_EVENT, locationOrLink: location }] },
    });

    const shown = await screen.findByText(location);

    expect(shown.closest('a')?.getAttribute('href') ?? null).toBe(href);
  });
});
