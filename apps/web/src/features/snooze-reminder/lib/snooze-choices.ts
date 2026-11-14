import type { SnoozeReminderInput } from '@jobflow/shared';

export const SNOOZE_DAYS = [3, 7] as const satisfies readonly SnoozeReminderInput['days'][];
