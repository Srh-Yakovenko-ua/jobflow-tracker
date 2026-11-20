'use client';

import { type ApplicationResponse, AUTH_ROUTES } from '@jobflow/shared';
import { useRouter } from 'next/navigation';

import { DeleteApplicationDialog } from '@/features/delete-application';
import { ScheduleEventDialog, type SchedulePlan } from '@/features/schedule-event';
import { useSheetClose } from '@/shared/ui/sheet';

import type { ApplicationPageState, ApplicationPanel } from '../model/use-application-page';
import type { ApplicationFocusTargets } from './application-actions';

export type PageDialogsProps = Readonly<{
  application: ApplicationResponse;
  page: Pick<ApplicationPageState, 'panel' | 'actions'>;
  focus: ApplicationFocusTargets;
}>;

function useLeaveAfterDelete(): () => void {
  const router = useRouter();
  const closeSheet = useSheetClose();
  if (closeSheet !== null) return closeSheet;
  return () => {
    router.replace(AUTH_ROUTES.home);
  };
}

function schedulePlanOf(panel: ApplicationPanel | null): SchedulePlan | null {
  if (panel?.kind === 'schedule' || panel?.kind === 'reschedule') return panel;
  return null;
}

function returnFocus(event: Event, target: HTMLElement | null) {
  event.preventDefault();
  target?.focus();
}

export function PageDialogs({ application, page, focus }: PageDialogsProps) {
  const onDeleted = useLeaveAfterDelete();
  const { panel, actions } = page;
  return (
    <>
      <DeleteApplicationDialog
        application={panel?.kind === 'delete' ? application : null}
        actions={{ onCancel: actions.onClose, onDeleted }}
        handlers={{
          onCloseAutoFocus: (event) => {
            returnFocus(event, focus.more.current);
          },
        }}
      />
      <ScheduleEventDialog
        application={application}
        plan={schedulePlanOf(panel)}
        actions={{ onClose: actions.onClose }}
        handlers={{
          onCloseAutoFocus: (event) => {
            returnFocus(event, focus.title.current);
          },
        }}
      />
    </>
  );
}
