'use client';

import type { Application, ApplicationResponse, Stage } from '@jobflow/shared';
import { useRef } from 'react';

import { ApplicationEditForm, type EditField } from '@/features/edit-application';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { NotFoundState } from '@/shared/ui/not-found-state';
import { Reveal } from '@/shared/ui/reveal';
import { PageSkeleton } from '@/shared/ui/skeleton';

import { useApplicationMatch } from '../model/use-application-match';
import {
  type ApplicationPageActions,
  type ApplicationPageState,
  useApplicationPage,
} from '../model/use-application-page';
import { ApplicationActions, type ApplicationFocusTargets } from './application-actions';
import { ApplicationContext } from './application-context';
import { ApplicationFollowup } from './application-followup';
import { ApplicationHeader } from './application-header';
import { ApplicationRecruiter } from './application-recruiter';
import { ApplicationSchedule } from './application-schedule';
import { AttachedResume } from './attached-resume';
import { PageColumns } from './page-columns';
import { PageDialogs } from './page-dialogs';
import { PageMain } from './page-main';
import { type ApplicationPageMode, PageTopBar } from './page-top-bar';

export type { ApplicationPageMode } from './page-top-bar';

export type ApplicationPageProps = Readonly<{
  id: Application['id'];
  view: { mode: ApplicationPageMode };
}>;

type PageActionsProps = Readonly<{
  application: ApplicationResponse;
  page: Readonly<{ actions: ApplicationPageActions; suggestion: Stage | null }>;
  focus: ApplicationFocusTargets;
}>;

function PageActions({ application, page, focus }: PageActionsProps) {
  const { actions, suggestion } = page;
  return (
    <div className="flex flex-col gap-4">
      <ApplicationSchedule application={application} actions={actions} suggestion={suggestion} />
      <ApplicationActions
        application={application}
        actions={actions}
        focus={focus}
        suggestion={suggestion}
      />
    </div>
  );
}

type PageEditingProps = Readonly<{
  application: ApplicationResponse;
  page: ApplicationPageState;
  editor: Readonly<{ editing: EditField | null; onDone: () => void }>;
  focus: ApplicationFocusTargets;
}>;

function PageEditing({ application, page, editor, focus }: PageEditingProps) {
  const { editing } = editor;
  return (
    <div>
      <Reveal shown={editing === null}>
        <PageActions application={application} page={page} focus={focus} />
      </Reveal>
      <Reveal shown={editing !== null}>
        {editing !== null && (
          <ApplicationEditForm
            application={application}
            focusField={editing}
            actions={{ onDone: editor.onDone }}
          />
        )}
      </Reveal>
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
  const moreRef = useRef<HTMLButtonElement>(null);
  const focus = { title: titleRef, more: moreRef };
  const match = useApplicationMatch(application);
  const { panel } = page;
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
      <PageColumns
        view={view}
        slots={{
          header: (
            <ApplicationHeader
              application={application}
              titleRef={titleRef}
              editor={{ editing: editing !== null, onEdit: page.actions.onEdit }}
            >
              <PageEditing
                application={application}
                page={page}
                editor={{ editing, onDone: closeEditor }}
                focus={focus}
              />
            </ApplicationHeader>
          ),
          followup: <ApplicationFollowup application={application} />,
          main: <PageMain application={application} match={match} />,
          side: (
            <>
              <ApplicationRecruiter key={application.id} application={application} />
              <AttachedResume
                application={application}
                actions={{ onRelinked: match.onRelinked }}
              />
              <ApplicationContext application={application} />
            </>
          ),
        }}
      />
      <PageDialogs application={application} page={page} focus={focus} />
    </div>
  );
}

function PageContent({ id, view }: ApplicationPageProps) {
  const page = useApplicationPage(id);
  const { application } = page;
  if (page.missing) return <NotFoundState />;
  if (application === undefined) {
    return page.load.failed ? (
      <LoadFailedPanel load={page.load} />
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
