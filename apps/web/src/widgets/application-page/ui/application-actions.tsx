'use client';

import {
  type ApplicationResponse,
  canTransition,
  type Stage,
  STAGE_LABELS,
  TERMINAL_STAGES,
} from '@jobflow/shared';
import { CalendarPlus, Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { type RefObject, useRef } from 'react';

import {
  nextStageOf,
  useMoveApplicationMutation,
  useUndoMoveMutation,
} from '@/features/move-application';
import { RejectionReasonDialog, useRejectionPrompt } from '@/features/reject-with-reason';
import { uk } from '@/shared/i18n';
import { NEW_TAB, webUrlOf } from '@/shared/lib/web-url';
import { Button, buttonLinkClasses } from '@/shared/ui/button';
import { DANGER_MENU_ITEM, Menu, MenuContent, MenuItem, MenuTrigger } from '@/shared/ui/menu';

import type { ApplicationPageActions } from '../model/use-application-page';

export type ApplicationActionsProps = Readonly<{
  application: ApplicationResponse;
  actions: ApplicationPageActions;
  focusTarget: RefObject<HTMLHeadingElement | null>;
  suggestion: Stage | null;
}>;

const COPY = uk.applicationPage;

function MoreMenu({ actions }: Readonly<{ actions: ApplicationPageActions }>) {
  const editChosenRef = useRef(false);
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={COPY.more}
          icon={<Ellipsis aria-hidden size={16} strokeWidth={1.9} />}
        />
      </MenuTrigger>
      <MenuContent
        onCloseAutoFocus={(event) => {
          if (!editChosenRef.current) return;
          editChosenRef.current = false;
          event.preventDefault();
          actions.onEdit('position');
        }}
      >
        <MenuItem
          onSelect={() => {
            editChosenRef.current = true;
          }}
        >
          <Pencil aria-hidden size={16} strokeWidth={1.9} />
          {COPY.edit}
        </MenuItem>
        <MenuItem className={DANGER_MENU_ITEM} onSelect={actions.onDelete}>
          <Trash2 aria-hidden size={16} strokeWidth={1.9} />
          {COPY.delete}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function VacancyLink({ url }: Readonly<{ url: string | null }>) {
  const href = webUrlOf(url);
  if (href === null) return null;
  return (
    <a href={href} {...NEW_TAB} className={buttonLinkClasses({ variant: 'outline', size: 'md' })}>
      {COPY.openVacancy}
    </a>
  );
}

export function ApplicationActions({
  application,
  actions,
  focusTarget,
  suggestion,
}: ApplicationActionsProps) {
  const move = useMoveApplicationMutation();
  const { mutate: undo } = useUndoMoveMutation();
  const rejection = useRejectionPrompt({ send: move.mutate, undo });
  const next = suggestion === null ? nextStageOf(application.currentStage) : null;
  return (
    <div className="flex flex-wrap gap-2.5 pt-1">
      {next !== null && (
        <Button
          loading={move.isPending}
          onClick={() => {
            move.mutate({ application, toStage: next });
          }}
        >
          {COPY.moveTo(STAGE_LABELS[next].labelUk)}
        </Button>
      )}
      {!TERMINAL_STAGES.includes(application.currentStage) && (
        <Button
          variant="outline"
          icon={<CalendarPlus aria-hidden size={16} strokeWidth={1.9} />}
          onClick={actions.onSchedule}
        >
          {COPY.schedule.action}
        </Button>
      )}
      <VacancyLink url={application.url} />
      {canTransition(application.currentStage, 'rejected').ok && (
        <Button
          variant="reject"
          onClick={() => {
            rejection.ask({ application });
          }}
        >
          {COPY.reject}
        </Button>
      )}
      <MoreMenu actions={actions} />
      <RejectionReasonDialog
        prompt={rejection.prompt}
        actions={rejection.actions}
        handlers={{
          onCloseAutoFocus: (event) => {
            event.preventDefault();
            focusTarget.current?.focus();
          },
        }}
      />
    </div>
  );
}
