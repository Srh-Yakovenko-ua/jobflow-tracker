'use client';

import type { Reminder } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { useMenuChoice } from '@/shared/lib/use-menu-choice';
import { Button } from '@/shared/ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/shared/ui/menu';

import { SNOOZE_DAYS } from '../lib/snooze-choices';
import { useSnoozeReminderMutation } from '../model/use-snooze-reminder-mutation';

const COPY = uk.reminders.actions;

export type SnoozeMenuProps = Readonly<{
  reminder: Pick<Reminder, 'id'>;
  actions?: Readonly<{ onSnoozed?: () => void }>;
}>;

export function SnoozeMenu({ reminder, actions = {} }: SnoozeMenuProps) {
  const { mutate } = useSnoozeReminderMutation();
  const choice = useMenuChoice(actions.onSnoozed);
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="sm">
          {COPY.snooze}
        </Button>
      </MenuTrigger>
      <MenuContent className="w-auto min-w-40" onCloseAutoFocus={choice.onCloseAutoFocus}>
        {SNOOZE_DAYS.map((days) => (
          <MenuItem
            key={days}
            className="tabular-nums"
            onSelect={() => {
              choice.choose();
              mutate({ id: reminder.id, days });
            }}
          >
            {COPY.snoozeFor(days)}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
