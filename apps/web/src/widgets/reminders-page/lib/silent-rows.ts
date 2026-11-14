import type { ApplicationBoardResponse, BoardCard, Reminder } from '@jobflow/shared';

export type SilentRow = Readonly<{ card: BoardCard; reminder: Reminder | null }>;

export type SilentRowsInput = Readonly<{
  board: ApplicationBoardResponse;
  reminders: readonly Reminder[];
  now: Date;
}>;

function isActiveFollowup(reminder: Reminder): boolean {
  return reminder.type === 'followup' && ['pending', 'snoozed'].includes(reminder.status);
}

function isSnoozedAt(reminder: Reminder | null, now: Date): boolean {
  if (reminder?.status !== 'snoozed' || reminder.snoozedUntil === null) return false;
  return Date.parse(reminder.snoozedUntil) > now.getTime();
}

function byLongestSilence(left: SilentRow, right: SilentRow): number {
  const days = right.card.daysSinceLastEvent - left.card.daysSinceLastEvent;
  return days === 0 ? left.card.id.localeCompare(right.card.id) : days;
}

export function silentRowsOf({ board, reminders, now }: SilentRowsInput): SilentRow[] {
  const followups = new Map(
    reminders.filter(isActiveFollowup).map((reminder) => [reminder.applicationId, reminder]),
  );
  return Object.values(board.columns)
    .flatMap((column) => column.items ?? [])
    .map((card) => ({ card, reminder: followups.get(card.id) ?? null }))
    .filter((row) => !isSnoozedAt(row.reminder, now))
    .sort(byLongestSilence);
}
