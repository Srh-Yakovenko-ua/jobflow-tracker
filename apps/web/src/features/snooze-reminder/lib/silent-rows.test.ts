import { addMilliseconds } from 'date-fns';
import { describe, expect, it } from 'vitest';

import {
  ACME_SILENT,
  followupOf,
  IN_THREE_DAYS,
  interviewSoonOf,
  KVIT_SILENT,
  REMINDER_LIST,
  REMINDER_NOW,
  reminderIdOf,
  SILENT_CARDS,
  SILENT_FOLLOWUPS,
  silentBoardOf,
  silentCardOf,
  ZORIA_SILENT,
} from '@/test/reminder-fixtures';

import { silentRowsOf } from './silent-rows';

const BOARD = silentBoardOf(SILENT_CARDS);

function companiesAt(now: Date, reminders = REMINDER_LIST.items) {
  return silentRowsOf({ board: BOARD, reminders, now }).map((row) => row.card.company);
}

describe('silentRowsOf', () => {
  it('hides a card whose followup is snoozed until three days from now and shows one whose snooze ran out', () => {
    expect(companiesAt(REMINDER_NOW)).toEqual(['Zoria Tech', 'Acme']);
  });

  it('brings the card back one millisecond after the snooze ends', () => {
    expect(companiesAt(addMilliseconds(new Date(IN_THREE_DAYS), 1))).toEqual([
      'Zoria Tech',
      'Acme',
      'Kvit Software',
    ]);
  });

  it('shows every card with a pending followup, the longest silence first', () => {
    expect(companiesAt(REMINDER_NOW, [...SILENT_FOLLOWUPS])).toEqual([
      'Zoria Tech',
      'Acme',
      'Kvit Software',
    ]);
  });

  it('joins each card to its own followup and leaves a card the scan has not reached without one', () => {
    const rows = silentRowsOf({
      board: BOARD,
      reminders: [...SILENT_FOLLOWUPS],
      now: REMINDER_NOW,
    });

    expect(rows.map((row) => [row.card.id, row.reminder?.id ?? null])).toEqual([
      [ZORIA_SILENT.id, null],
      [ACME_SILENT.id, reminderIdOf(ACME_SILENT)],
      [KVIT_SILENT.id, reminderIdOf(KVIT_SILENT)],
    ]);
  });

  it('a done followup or an interview reminder is no snooze target', () => {
    const done = followupOf({ card: ACME_SILENT, status: 'done' });
    const rows = silentRowsOf({
      board: BOARD,
      reminders: [done, interviewSoonOf(KVIT_SILENT)],
      now: REMINDER_NOW,
    });

    expect(rows.map((row) => row.reminder)).toEqual([null, null, null]);
  });

  it('cards with the same silence keep the order of their ids', () => {
    const twin = silentCardOf({ serial: 800, company: 'Twin', days: 14, stage: 'final' });
    const board = silentBoardOf([...SILENT_CARDS, twin]);

    const rows = silentRowsOf({ board, reminders: [], now: REMINDER_NOW });

    expect(rows.map((row) => row.card.company)).toEqual([
      'Zoria Tech',
      'Twin',
      'Acme',
      'Kvit Software',
    ]);
  });
});
