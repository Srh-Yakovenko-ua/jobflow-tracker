'use client';

import { STAGE_LABELS } from '@jobflow/shared';

import { type ApplicationMove, type MovingApplication, StageMarker } from '@/entities/application';
import { legalMovesFrom } from '@/features/move-application';
import { uk } from '@/shared/i18n';
import { useMenuChoice } from '@/shared/lib/use-menu-choice';
import { Button } from '@/shared/ui/button';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '@/shared/ui/menu';

import type { ReplyMove } from '../model/use-reply-move';

const COPY = uk.reminders.actions;

export type ReplyMenuActions = Readonly<{ moveTo: ReplyMove['moveTo']; onMoved: () => void }>;

export type ReplyMenuProps = Readonly<{
  application: MovingApplication;
  actions: ReplyMenuActions;
}>;

export function ReplyMenu({ application, actions }: ReplyMenuProps) {
  const choice = useMenuChoice(actions.onMoved);
  const stages = legalMovesFrom(application.currentStage).filter((stage) => stage !== 'ghosted');
  const moveTo = (move: ApplicationMove) => {
    if (actions.moveTo(move) === 'sent') choice.choose();
  };
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary" size="sm">
          {COPY.reply}
        </Button>
      </MenuTrigger>
      <MenuContent onCloseAutoFocus={choice.onCloseAutoFocus}>
        <MenuLabel>{COPY.replyTo(application.company)}</MenuLabel>
        {stages.map((stage) => (
          <MenuItem
            key={stage}
            onSelect={() => {
              moveTo({ application, toStage: stage });
            }}
          >
            <StageMarker stage={stage} />
            {STAGE_LABELS[stage].labelUk}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
