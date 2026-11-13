import { type ApplicationResponse, countedUk, DAY_FORMS_UK } from '@jobflow/shared';
import { useEffect } from 'react';

import { FollowupPanel } from '@/features/generate-followup';
import { uk } from '@/shared/i18n';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { TextSkeleton } from '@/shared/ui/skeleton';

import {
  type ApplicationFollowupState,
  useApplicationFollowup,
} from '../model/use-application-followup';
import { ApplicationSection } from './application-section';

export type ApplicationFollowupProps = Readonly<{ application: ApplicationResponse }>;

type FollowupBodyProps = Readonly<{
  application: ApplicationResponse;
  followup: ApplicationFollowupState;
}>;

function FollowupBody({ application, followup }: FollowupBodyProps) {
  const { load, response, job } = followup;
  if (load.failed) return <LoadFailedPanel onRetry={load.onRetry} />;
  if (response === undefined) return <TextSkeleton />;
  return <FollowupPanel application={application} followup={{ response, job }} />;
}

const ANCHOR = 'follow-up';

function useAnchorArrival() {
  useEffect(() => {
    if (window.location.hash !== `#${ANCHOR}`) return;
    document.getElementById(ANCHOR)?.scrollIntoView({ block: 'start' });
  }, []);
}

export function ApplicationFollowup({ application }: ApplicationFollowupProps) {
  const followup = useApplicationFollowup(application);
  useAnchorArrival();
  if (!followup.shown) return null;
  const days = followup.response?.silenceDays;
  const silence = days !== undefined && (
    <span
      key={days}
      className="animate-fade-in font-ui text-[10px] font-semibold text-ink-3 tabular-nums"
    >
      {uk.application.silence(countedUk(days, DAY_FORMS_UK))}
    </span>
  );
  return (
    <ApplicationSection
      title={{ text: uk.followup.kicker, look: 'eyebrow' }}
      header={{ after: silence, className: 'flex items-center justify-between gap-3' }}
      view={{
        id: ANCHOR,
        className:
          'flex scroll-mt-6 flex-col gap-3.5 rounded-lg bg-surface p-4.5 shadow-e1 inset-ring inset-ring-accent/25',
        busy: followup.load.pending,
      }}
    >
      <FollowupBody application={application} followup={followup} />
    </ApplicationSection>
  );
}
