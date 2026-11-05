'use client';

import type { Application } from '@jobflow/shared';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

import { DeleteApplicationDialog } from '@/features/delete-application';
import { ApplicationEditForm } from '@/features/edit-application';
import { AUTH_ROUTES } from '@/shared/lib/return-to';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { NotFoundState } from '@/shared/ui/not-found-state';
import { Reveal } from '@/shared/ui/reveal';
import { useSheetClose } from '@/shared/ui/sheet';
import { PageSkeleton } from '@/shared/ui/skeleton';

import { useApplicationPage } from '../model/use-application-page';
import { ApplicationActions } from './application-actions';
import { ApplicationHeader } from './application-header';
import { ApplicationTimeline } from './application-timeline';
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

function PageContent({ id, view }: ApplicationPageProps) {
  const page = useApplicationPage(id);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const onDeleted = useLeaveAfterDelete();
  const { application, panel } = page;
  if (page.missing) return <NotFoundState />;
  if (application === undefined) {
    return page.load.failed ? (
      <LoadFailedPanel onRetry={page.load.onRetry} />
    ) : (
      <PageSkeleton className="pt-14" />
    );
  }
  const editing = panel?.kind === 'edit' ? panel.field : null;
  const focusTitle = () => {
    titleRef.current?.focus();
  };
  const closeEditor = () => {
    page.actions.onClose();
    focusTitle();
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
                <ApplicationActions
                  application={application}
                  actions={page.actions}
                  focusTarget={titleRef}
                />
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
          <ApplicationTimeline application={application} />
        </div>
        <div />
      </div>
      <DeleteApplicationDialog
        application={panel?.kind === 'delete' ? application : null}
        actions={{ onCancel: page.actions.onClose, onDeleted }}
        handlers={{
          onCloseAutoFocus: (event) => {
            event.preventDefault();
            focusTitle();
          },
        }}
      />
    </div>
  );
}

export function ApplicationPage({ id, view }: ApplicationPageProps) {
  return (
    <div className="@container mx-auto w-full max-w-[1180px]">
      <PageContent id={id} view={view} />
    </div>
  );
}
