import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { latch } from '@/test/latch';
import { renderInApp } from '@/test/render-in-app';
import { SCHEDULE_NOW } from '@/test/schedule-dialog';
import {
  scheduledEventOf,
  scheduledEventRoutes,
  type ScheduledEventRoutesOptions,
} from '@/test/scheduled-event-fixtures';
import { server } from '@/test/server';

import { EventOutcomePrompt } from './event-outcome-prompt';

const PAST_EVENT = scheduledEventOf({ startsAt: '2026-11-06T14:00:00Z', durationMin: 60 });

const OUTCOMES = ['Пройдено', 'Перенесли', 'Скасували'] as const;

function renderPrompt(routes: Omit<ScheduledEventRoutesOptions, 'items'> = {}) {
  const events = scheduledEventRoutes({ items: [PAST_EVENT], ...routes });
  server.use(...events.handlers);
  const actions = { onCompleted: vi.fn(), onReschedule: vi.fn() };
  const user = renderInApp(
    <EventOutcomePrompt
      event={PAST_EVENT}
      context={{ now: SCHEDULE_NOW, timeZone: 'Europe/Kyiv' }}
      actions={actions}
    />,
  );
  const prompt = within(screen.getByRole('region', { name: 'Як пройшло?' }));
  return { user, actions, prompt, sent: events.sent };
}

function disabledOutcomes(): boolean[] {
  const prompt = within(screen.getByRole('region', { name: 'Як пройшло?' }));
  return OUTCOMES.map((name) => prompt.getByRole('button', { name }).hasAttribute('disabled'));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EventOutcomePrompt', () => {
  it('Пройдено sends done with the edited duration and hands on the suggested stage', async () => {
    const { user, actions, prompt, sent } = renderPrompt({ update: { suggestedStage: 'final' } });
    const duration = prompt.getByRole('spinbutton', { name: 'Тривалість' });
    expect(duration.getAttribute('aria-valuenow')).toBe('60');

    await user.clear(duration);
    await user.type(duration, '75');
    await user.click(prompt.getByRole('button', { name: 'Пройдено' }));

    await waitFor(() => {
      expect(actions.onCompleted).toHaveBeenCalledWith('final');
    });
    expect(sent.updated).toEqual([
      { itemId: PAST_EVENT.id, body: { status: 'done', durationMin: 75 } },
    ]);
  });

  it('Скасували sends only the cancelled status and suggests nothing', async () => {
    const { user, actions, prompt, sent } = renderPrompt();

    await user.click(prompt.getByRole('button', { name: 'Скасували' }));

    await waitFor(() => {
      expect(sent.updated).toEqual([{ itemId: PAST_EVENT.id, body: { status: 'cancelled' } }]);
    });
    expect(actions.onCompleted).not.toHaveBeenCalled();
  });

  it('Перенесли hands the event to the reschedule and sends nothing', async () => {
    const { user, actions, prompt, sent } = renderPrompt();

    await user.click(prompt.getByRole('button', { name: 'Перенесли' }));

    expect(actions.onReschedule).toHaveBeenCalledWith(PAST_EVENT);
    expect(sent.updated).toEqual([]);
  });

  it('while one answer is held all three are disabled and a second press sends nothing', async () => {
    const held = latch();
    const { user, prompt, sent } = renderPrompt({ update: { latch: held } });

    await user.click(prompt.getByRole('button', { name: 'Пройдено' }));

    await waitFor(() => {
      expect(disabledOutcomes()).toEqual([true, true, true]);
    });
    expect(prompt.getByRole('button', { name: 'Пройдено' }).getAttribute('aria-busy')).toBe('true');
    await user.click(prompt.getByRole('button', { name: 'Скасували' }));
    expect(sent.updated).toHaveLength(1);
    held.release();
  });
});
