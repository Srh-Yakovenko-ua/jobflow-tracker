'use client';

import {
  applicationPatchSchema,
  type ApplicationResponse,
  canTransition,
  STAGE_LABELS,
} from '@jobflow/shared';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import type { RefObject } from 'react';

import {
  nextStageOf,
  useMoveApplicationMutation,
  useUndoMoveMutation,
} from '@/features/move-application';
import { RejectionReasonDialog, useRejectionPrompt } from '@/features/reject-with-reason';
import { uk } from '@/shared/i18n';
import { Button, buttonLinkClasses } from '@/shared/ui/button';
import { DANGER_MENU_ITEM, Menu, MenuContent, MenuItem, MenuTrigger } from '@/shared/ui/menu';

import type { ApplicationPageActions } from '../model/use-application-page';

export type ApplicationActionsProps = Readonly<{
  application: ApplicationResponse;
  actions: ApplicationPageActions;
  focusTarget: RefObject<HTMLHeadingElement | null>;
}>;

const COPY = uk.applicationPage;

function MoreMenu({ actions }: Readonly<{ actions: ApplicationPageActions }>) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={COPY.more}
          icon={<Ellipsis aria-hidden size={16} strokeWidth={1.9} />}
        />
      </MenuTrigger>
      <MenuContent>
        <MenuItem
          onSelect={() => {
            actions.onEdit('position');
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
  if (url === null || !applicationPatchSchema.shape.url.safeParse(url).success) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonLinkClasses({ variant: 'outline', size: 'md' })}
    >
      {COPY.openVacancy}
    </a>
  );
}

export function ApplicationActions({ application, actions, focusTarget }: ApplicationActionsProps) {
  const move = useMoveApplicationMutation();
  const { mutate: send } = useMoveApplicationMutation();
  const { mutate: undo } = useUndoMoveMutation();
  const rejection = useRejectionPrompt({ send, undo });
  const next = nextStageOf(application.currentStage);
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
