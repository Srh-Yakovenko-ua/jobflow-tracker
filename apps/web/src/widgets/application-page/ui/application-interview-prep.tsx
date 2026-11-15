import type { ApplicationResponse } from '@jobflow/shared';

import { InterviewPrepPanel } from '@/features/prepare-interview';
import { uk } from '@/shared/i18n';

import { useApplicationInterviewPrep } from '../model/use-application-interview-prep';
import { AiPageSection } from './ai-page-section';

export type ApplicationInterviewPrepProps = Readonly<{ application: ApplicationResponse }>;

export function ApplicationInterviewPrep({ application }: ApplicationInterviewPrepProps) {
  const { section, requestable } = useApplicationInterviewPrep(application);
  return (
    <AiPageSection title={uk.interviewPrep.title} section={section}>
      {(ready) => <InterviewPrepPanel application={application} prep={{ ...ready, requestable }} />}
    </AiPageSection>
  );
}
