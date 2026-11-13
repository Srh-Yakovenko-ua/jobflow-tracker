'use client';

import type { Application, ApplicationResponse, Stage } from '@jobflow/shared';
import { useRouter } from 'next/navigation';
import { type RefObject, useRef } from 'react';

import { DeleteApplicationDialog } from '@/features/delete-application';
import { ApplicationEditForm } from '@/features/edit-application';
import { ScheduleEventDialog, type SchedulePlan } from '@/features/schedule-event';
import { AUTH_ROUTES } from '@/shared/lib/return-to';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { NotFoundState } from '@/shared/ui/not-found-state';
import { Reveal } from '@/shared/ui/reveal';
import { useSheetClose } from '@/shared/ui/sheet';
import { PageSkeleton } from '@/shared/ui/skeleton';

import { useApplicationMatch } from '../model/use-application-match';
import {
  type ApplicationPageActions,
  type ApplicationPageState,
  type ApplicationPanel,
  useApplicationPage,
} from '../model/use-application-page';
import { ApplicationActions } from './application-actions';
import { ApplicationContext } from './application-context';
import { ApplicationFollowup } from './application-followup';
import { ApplicationHeader } from './application-header';
import { ApplicationMatch } from './application-match';
import { ApplicationNotes } from './application-notes';
import { ApplicationRecruiter } from './application-recruiter';
import { ApplicationSchedule } from './application-schedule';
import { ApplicationTimeline } from './application-timeline';
import { AttachedResume } from './attached-resume';
import { type ApplicationPageMode, PageTopBar } from './page-top-bar';

export type { ApplicationPageMode } from './page-top-bar';

export type ApplicationPageProps = Readonly<{
  id: Application['id'];
  view: { mode: ApplicationPageMode };
}>;

const COLUMNS =
  'grid grid-cols-1 items-start gap-10 pt-8 @4xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]';

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

type PageActionsProps = Readonly<{
  application: ApplicationResponse;
  page: Readonly<{ actions: ApplicationPageActions; suggestion: Stage | null }>;
  focusTarget: RefObject<HTMLHeadingElement | null>;
}>;

function PageActions({ application, page, focusTarget }: PageActionsProps) {
  const { actions, suggestion } = page;
  return (
    <div className="flex flex-col gap-4">
      <ApplicationSchedule application={application} actions={actions} suggestion={suggestion} />
      <ApplicationActions
        application={application}
        actions={actions}
        focusTarget={focusTarget}
        suggestion={suggestion}
      />
    </div>
  );
}

type LoadedPageProps = Readonly<{
  application: ApplicationResponse;
  page: ApplicationPageState;
  view: ApplicationPageProps['view'];
}>;

function LoadedPage({ application, page, view }: LoadedPageProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const onDeleted = useLeaveAfterDelete();
  const match = useApplicationMatch(application);
  const { panel } = page;
  const editing = panel?.kind === 'edit' ? panel.field : null;
  const singleColumn = view.mode === 'sheet';
  const followup = <ApplicationFollowup application={application} />;
  const focusTitle = () => {
    titleRef.current?.focus();
  };
  const closeEditor = () => {
    page.actions.onClose();
    focusTitle();
  };
  const returnFocus = {
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      focusTitle();
    },
  };
  return (
    <div className="animate-fade-in">
      <PageTopBar application={application} view={{ mode: view.mode, timeZone: page.timeZone }} />
      <div className={COLUMNS}>
        <div className="flex min-w-0 flex-col gap-10">
          <ApplicationHeader
            application={application}
            titleRef={titleRef}
            editor={{ editing: editing !== null, onEdit: page.actions.onEdit }}
          >
            <div>
              <Reveal shown={editing === null}>
                <PageActions application={application} page={page} focusTarget={titleRef} />
              </Reveal>
              <Reveal shown={editing !== null}>
                {editing !== null && (
                  <ApplicationEditForm
                    application={application}
                    focusField={editing}
                    actions={{ onDone: closeEditor }}
                  />
                )}
              </Reveal>
            </div>
          </ApplicationHeader>
          {singleColumn && followup}
          <ApplicationMatch match={match} />
          <ApplicationTimeline application={application} />
          <ApplicationNotes key={application.id} application={application} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          {!singleColumn && followup}
          <ApplicationRecruiter key={application.id} application={application} />
          <AttachedResume application={application} actions={{ onRelinked: match.onRelinked }} />
          <ApplicationContext application={application} />
        </div>
      </div>
      <DeleteApplicationDialog
        application={panel?.kind === 'delete' ? application : null}
        actions={{ onCancel: page.actions.onClose, onDeleted }}
        handlers={returnFocus}
      />
      <ScheduleEventDialog
        application={application}
        plan={schedulePlanOf(panel)}
        actions={{ onClose: page.actions.onClose }}
        handlers={returnFocus}
      />
    </div>
  );
}

function PageContent({ id, view }: ApplicationPageProps) {
  const page = useApplicationPage(id);
  const { application } = page;
  if (page.missing) return <NotFoundState />;
  if (application === undefined) {
    return page.load.failed ? (
      <LoadFailedPanel onRetry={page.load.onRetry} />
    ) : (
      <PageSkeleton className="pt-14" />
    );
  }
  return <LoadedPage key={application.id} application={application} page={page} view={view} />;
}

export function ApplicationPage({ id, view }: ApplicationPageProps) {
  return (
    <div className="@container mx-auto w-full max-w-[1180px]">
      <PageContent id={id} view={view} />
    </div>
  );
}
