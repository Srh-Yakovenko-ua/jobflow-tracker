import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { expect, vi } from 'vitest';

import { uk } from '@/shared/i18n';

const COPY = uk.applicationPage.schedule;

export const SCHEDULE_NOW = new Date('2026-11-06T22:30:00Z');

export const KYIV_TOMORROW = '08.11.2026';

export function pinScheduleClock(): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SCHEDULE_NOW);
}

export function pinScheduleClockWithTimeouts(): void {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
  vi.setSystemTime(SCHEDULE_NOW);
}

export async function findScheduleDialog(title: string = COPY.titles.schedule) {
  return within(await screen.findByRole('dialog', { name: title }));
}

export function dateTrigger(): HTMLElement {
  return screen.getByRole('button', { name: (name) => name.startsWith(COPY.fields.date) });
}

export async function waitForDate(shown: string): Promise<void> {
  await waitFor(() => {
    expect(dateTrigger().textContent).toBe(shown);
  });
}

export async function pickToday(user: UserEvent): Promise<void> {
  await user.click(dateTrigger());
  const calendar = within(screen.getByRole('dialog', { name: uk.calendar.label }));
  await user.click(calendar.getByRole('button', { name: uk.calendar.today }));
  await user.click(calendar.getByRole('button', { name: uk.calendar.done }));
}

export async function typeTime({ user, time }: { user: UserEvent; time: string }): Promise<void> {
  const field = screen.getByLabelText(COPY.fields.time);
  await user.clear(field);
  await user.type(field, time);
}

export async function openScheduleDialog(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: COPY.action }));
  const dialog = await findScheduleDialog();
  await waitForDate(KYIV_TOMORROW);
  return dialog;
}
