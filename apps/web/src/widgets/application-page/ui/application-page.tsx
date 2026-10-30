'use client';

import type { Application } from '@jobflow/shared';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

import { DeleteApplicationDialog } from '@/features/delete-application';
import { ApplicationEditForm } from '@/features/edit-application';
import { uk } from '@/shared/i18n';
import { AUTH_ROUTES } from '@/shared/lib/return-to';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { NotFoundState } from '@/shared/ui/not-found-state';
import { HeadingSkeleton, TextSkeleton } from '@/shared/ui/skeleton';

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

function PageSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8 pt-14">
      <p role="status" className="sr-only">
        {uk.ui.loading}
      </p>
      <HeadingSkeleton />
      <TextSkeleton />
    </div>
  );
}

function useLeaveAfterDelete(mode: ApplicationPageMode): () => void {
  const router = useRouter();
  if (mode === 'sheet') {
    return () => {
      router.back();
    };
  }
  return () => {
    router.replace(AUTH_ROUTES.home);
  };
}

function PageContent({ id, view }: ApplicationPageProps) {
  const page = useApplicationPage(id);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const onDeleted = useLeaveAfterDelete(view.mode);
  const { application, panel } = page;
  if (page.missing) return <NotFoundState />;
  if (application === undefined) {
    return page.load.failed ? <LoadFailedPanel onRetry={page.load.onRetry} /> : <PageSkeleton />;
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
    <>
      <PageTopBar application={application} view={{ mode: view.mode, timeZone: page.timeZone }} />
      <div className={COLUMNS}>
        <div className="flex min-w-0 flex-col gap-10">
          <ApplicationHeader
            application={application}
            titleRef={titleRef}
            editor={{ editing: editing !== null, onEdit: page.actions.onEdit }}
          >
            {editing === null ? (
              <ApplicationActions
                application={application}
                actions={page.actions}
                focusTarget={titleRef}
              />
            ) : (
              <ApplicationEditForm
                application={application}
                focusField={editing}
                actions={{ onDone: closeEditor }}
              />
            )}
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
    </>
  );
}

export function ApplicationPage({ id, view }: ApplicationPageProps) {
  return (
    <div className="@container mx-auto w-full max-w-[1180px]">
      <PageContent id={id} view={view} />
    </div>
  );
}
