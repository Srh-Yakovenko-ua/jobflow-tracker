import type { UserSettings } from '@jobflow/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pinClockInEachTest } from '@/test/pinned-clock';
import { regionOf, renderLoadedSettings } from '@/test/render-settings-page';

vi.mock('next/navigation', () => import('@/test/navigation'));
vi.mock('next/link', () => import('@/test/link'));

const GOAL_ON: Partial<UserSettings> = { weeklyGoalApplications: 8 };

const rhythmRegion = () => within(regionOf('Ритм пошуку'));

const goalSwitch = () => rhythmRegion().getByRole('switch', { name: /Тижнева ціль/ });

const pauseSwitch = () => rhythmRegion().getByRole('switch', { name: /Пауза/ });

const spin = (name: string) => rhythmRegion().getByRole('spinbutton', { name });

const stepOf = (field: string, step: 'Збільшити' | 'Зменшити') => {
  const group = spin(field).parentElement;
  if (group === null) throw new Error(`no stepper around ${field}`);
  return within(group).getByRole('button', { name: step });
};

const returnDate = () =>
  rhythmRegion().queryByRole('button', { name: (name) => name.startsWith('Дата повернення') });

pinClockInEachTest(new Date('2026-11-16T09:00:00Z'));

afterEach(() => {
  toast.dismiss();
});

async function patchesAfter(settings: Partial<UserSettings>, act: () => HTMLElement) {
  const { user, routes } = await renderLoadedSettings({ settings });
  await user.click(act());
  await waitFor(() => {
    expect(routes.patches).toHaveLength(1);
  });
  return routes.patches;
}

describe('RhythmSection', () => {
  it('with the goal off shows only the goal switch, and turning it on saves a starting goal of 5', async () => {
    const { user, routes } = await renderLoadedSettings();

    expect(goalSwitch().getAttribute('aria-checked')).toBe('false');
    expect(rhythmRegion().queryByRole('spinbutton')).toBeNull();
    expect(rhythmRegion().queryByRole('switch', { name: /Пауза/ })).toBeNull();
    await user.click(goalSwitch());

    await waitFor(() => {
      expect(routes.patches).toEqual([{ weeklyGoalApplications: 5 }]);
    });
  });

  it('turning the goal on takes the suggested goal when there is one', async () => {
    expect(await patchesAfter({ suggestedWeeklyGoal: 9 }, goalSwitch)).toEqual([
      { weeklyGoalApplications: 9 },
    ]);
  });

  it('turning the goal off saves no goal and nothing else', async () => {
    expect(await patchesAfter(GOAL_ON, goalSwitch)).toEqual([{ weeklyGoalApplications: null }]);
  });

  it('the applications field runs from 1 to 30 and a step saves only the applications goal', async () => {
    const patches = await patchesAfter(GOAL_ON, () => stepOf('Відгуків на тиждень', 'Збільшити'));

    const applications = spin('Відгуків на тиждень');
    expect([
      applications.getAttribute('aria-valuemin'),
      applications.getAttribute('aria-valuemax'),
    ]).toEqual(['1', '30']);
    expect(patches).toEqual([{ weeklyGoalApplications: 9 }]);
  });

  it('a follow-up goal of none reads 0, and a step up saves one follow-up', async () => {
    const patches = await patchesAfter(GOAL_ON, () =>
      stepOf('Фоллоу-апів на тиждень', 'Збільшити'),
    );

    expect(spin('Фоллоу-апів на тиждень').getAttribute('aria-valuemin')).toBe('0');
    expect(patches).toEqual([{ weeklyGoalFollowups: 1 }]);
  });

  it('a follow-up goal stepped down to 0 is saved as no follow-up goal', async () => {
    const settings = { ...GOAL_ON, weeklyGoalFollowups: 1 };

    expect(
      await patchesAfter(settings, () => stepOf('Фоллоу-апів на тиждень', 'Зменшити')),
    ).toEqual([{ weeklyGoalFollowups: null }]);
  });

  it('turning the pause on saves a return a week from today and shows the return date', async () => {
    const patches = await patchesAfter(GOAL_ON, pauseSwitch);

    expect(patches).toEqual([{ pausedUntil: '2026-11-23' }]);
    expect(pauseSwitch().getAttribute('aria-checked')).toBe('true');
    expect(returnDate()?.textContent).toBe('23.11.2026');
  });

  it('picking another return day saves only that day', async () => {
    const { user, routes } = await renderLoadedSettings({
      settings: { ...GOAL_ON, pausedFrom: '2026-11-16', pausedUntil: '2026-11-23' },
    });
    const field = returnDate();
    if (field === null) throw new Error('no return date while paused');

    await user.click(field);
    await user.click(screen.getByRole('gridcell', { name: 'середа, 25 листопада 2026 р.' }));

    await waitFor(() => {
      expect(routes.patches).toEqual([{ pausedUntil: '2026-11-25' }]);
    });
  });

  it('turning the pause off saves no return date', async () => {
    const settings = { ...GOAL_ON, pausedFrom: '2026-11-16', pausedUntil: '2026-11-23' };

    expect(await patchesAfter(settings, pauseSwitch)).toEqual([{ pausedUntil: null }]);
  });

  it('a pause that ended yesterday reads as off and hides the return date', async () => {
    await renderLoadedSettings({
      settings: { ...GOAL_ON, pausedFrom: '2026-11-09', pausedUntil: '2026-11-15' },
    });

    expect(pauseSwitch().getAttribute('aria-checked')).toBe('false');
    expect(returnDate()).toBeNull();
  });
});
