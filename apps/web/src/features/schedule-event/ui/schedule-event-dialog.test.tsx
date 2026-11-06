import { screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { errorReply } from '@/test/api-handlers';
import { ACME_APPLICATION } from '@/test/application-fixtures';
import { renderInApp } from '@/test/render-in-app';
import {
  dateTrigger,
  findScheduleDialog,
  KYIV_TOMORROW,
  pickToday,
  pinScheduleClock,
  typeTime,
  waitForDate,
} from '@/test/schedule-dialog';
import {
  scheduledEventOf,
  scheduledEventRoutes,
  type ScheduledEventRoutesOptions,
} from '@/test/scheduled-event-fixtures';
import { server } from '@/test/server';
import { meRoute } from '@/test/session-fixtures';

import { ScheduleEventDialog, type SchedulePlan } from './schedule-event-dialog';

type DialogSetup = { plan?: SchedulePlan; routes?: ScheduledEventRoutesOptions };

const PAST_EVENT = scheduledEventOf({
  startsAt: '2026-11-06T14:00:00Z',
  durationMin: 90,
  locationOrLink: 'https://meet.example.com/acme',
});

function renderDialog({ plan = { kind: 'schedule' }, routes = {} }: DialogSetup = {}) {
  const events = scheduledEventRoutes(routes);
  server.use(meRoute(), ...events.handlers);
  const onClose = vi.fn();
  const user = renderInApp(
    <ScheduleEventDialog application={ACME_APPLICATION} plan={plan} actions={{ onClose }} />,
  );
  return { user, onClose, sent: events.sent };
}

beforeEach(pinScheduleClock);

afterEach(() => {
  toast.dismiss();
  vi.useRealTimers();
});

describe('ScheduleEventDialog', () => {
  it('opens on tomorrow 10:00 in the user zone for 60 minutes and sends that start as UTC', async () => {
    const { user, onClose, sent } = renderDialog();
    const dialog = await findScheduleDialog();
    await waitForDate(KYIV_TOMORROW);

    expect(dialog.getByRole('combobox', { name: 'Тип' }).textContent).toContain("Техінтерв'ю");
    expect(dialog.getByLabelText<HTMLInputElement>('Час').value).toBe('10:00');
    expect(
      dialog.getByRole('spinbutton', { name: 'Тривалість' }).getAttribute('aria-valuenow'),
    ).toBe('60');
    await user.click(dialog.getByRole('button', { name: 'Запланувати' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(sent.created).toEqual([
      {
        id: ACME_APPLICATION.id,
        body: {
          kind: 'tech_interview',
          startsAt: '2026-11-08T08:00:00.000Z',
          durationMin: 60,
          locationOrLink: null,
        },
      },
    ]);
  });

  it('a start that already passed today stays open with the reason on the time field and sends nothing', async () => {
    const { user, onClose, sent } = renderDialog();
    const dialog = await findScheduleDialog();
    await waitForDate(KYIV_TOMORROW);

    await pickToday(user);
    await typeTime({ user, time: '00:15' });
    await user.click(dialog.getByRole('button', { name: 'Запланувати' }));

    const time = dialog.getByLabelText('Час');
    expect(await dialog.findByText('Цей час уже минув')).toBeDefined();
    expect(time.getAttribute('aria-invalid')).toBe('true');
    expect(dateTrigger().textContent).toBe('07.11.2026');
    expect(sent.created).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('the date field marks the event days of the application and blocks the days before today', async () => {
    const { user } = renderDialog({
      routes: { items: [scheduledEventOf({ startsAt: '2026-11-12T09:00:00Z' })] },
    });
    await findScheduleDialog();
    await waitForDate(KYIV_TOMORROW);

    await user.click(dateTrigger());

    const marked = await screen.findByRole('gridcell', {
      name: 'четвер, 12 листопада 2026 р., є події',
    });
    expect(marked.querySelector('[data-dot]')).not.toBeNull();
    const yesterday = screen.getByRole('gridcell', { name: 'пʼятниця, 6 листопада 2026 р.' });
    expect(yesterday.getAttribute('aria-disabled')).toBe('true');
    expect(
      screen
        .getByRole('gridcell', { name: 'субота, 7 листопада 2026 р.' })
        .getAttribute('aria-current'),
    ).toBe('date');
  });

  it('a reschedule opens on the event as planned and sends a PATCH with the new start', async () => {
    const { user, onClose, sent } = renderDialog({
      plan: { kind: 'reschedule', event: PAST_EVENT },
      routes: { items: [PAST_EVENT] },
    });
    const dialog = await findScheduleDialog('Перенести подію');
    await waitForDate('06.11.2026');

    expect(dialog.getByLabelText<HTMLInputElement>('Час').value).toBe('16:00');
    expect(dialog.getByLabelText<HTMLInputElement>('Посилання або місце').value).toBe(
      'https://meet.example.com/acme',
    );
    await pickToday(user);
    await typeTime({ user, time: '16:00' });
    await user.click(dialog.getByRole('button', { name: 'Перенести' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(sent.created).toEqual([]);
    expect(sent.updated).toEqual([
      {
        itemId: PAST_EVENT.id,
        body: {
          kind: 'tech_interview',
          startsAt: '2026-11-07T14:00:00.000Z',
          durationMin: 90,
          locationOrLink: 'https://meet.example.com/acme',
        },
      },
    ]);
  });

  it('a 422 on the duration shows the Ukrainian rule under Тривалість and keeps the dialog', async () => {
    const { user, onClose } = renderDialog({
      routes: {
        create: {
          reply: () =>
            errorReply({
              status: 422,
              type: 'validation_error',
              errors: [{ path: 'durationMin', message: 'Too big' }],
            }),
        },
      },
    });
    const dialog = await findScheduleDialog();
    await waitForDate(KYIV_TOMORROW);

    await user.click(dialog.getByRole('button', { name: 'Запланувати' }));

    expect(await dialog.findByText('Від 5 до 480 хвилин')).toBeDefined();
    expect(
      dialog.getByRole('spinbutton', { name: 'Тривалість' }).getAttribute('aria-invalid'),
    ).toBe('true');
    expect(onClose).not.toHaveBeenCalled();
  });
});
