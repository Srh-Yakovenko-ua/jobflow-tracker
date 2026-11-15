import type { ApplicationResponse } from '@jobflow/shared';

import type { ApplicationMatchState } from '../model/use-application-match';
import { ApplicationCvHints } from './application-cv-hints';
import { ApplicationInterviewPrep } from './application-interview-prep';
import { ApplicationMatch } from './application-match';
import { ApplicationNotes } from './application-notes';
import { ApplicationTimeline } from './application-timeline';

export type PageMainProps = Readonly<{
  application: ApplicationResponse;
  match: ApplicationMatchState;
}>;

export function PageMain({ application, match }: PageMainProps) {
  return (
    <>
      <ApplicationMatch match={match} />
      <ApplicationCvHints application={application} match={match.view} />
      <ApplicationInterviewPrep application={application} />
      <ApplicationTimeline application={application} />
      <ApplicationNotes key={application.id} application={application} />
    </>
  );
}
