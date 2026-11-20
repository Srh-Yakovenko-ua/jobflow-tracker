import { type ApplicationResponse, countedUk, DAY_FORMS_UK } from '@jobflow/shared';
import { useEffect } from 'react';

import { AiSectionBody, FOLLOW_UP_ANCHOR } from '@/entities/application';
import { FollowupPanel } from '@/features/generate-followup';
import { uk } from '@/shared/i18n';

import { useApplicationFollowup } from '../model/use-application-followup';
import { ApplicationSection } from './application-section';

export type ApplicationFollowupProps = Readonly<{ application: ApplicationResponse }>;

function useAnchorArrival() {
  useEffect(() => {
    if (window.location.hash !== `#${FOLLOW_UP_ANCHOR}`) return;
    document.getElementById(FOLLOW_UP_ANCHOR)?.scrollIntoView({ block: 'start' });
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
        id: FOLLOW_UP_ANCHOR,
        className:
          'flex scroll-mt-6 flex-col gap-3.5 rounded-lg bg-surface p-4.5 shadow-e1 inset-ring inset-ring-accent/25',
        busy: followup.load.busy,
      }}
    >
      <AiSectionBody section={followup}>
        {(ready) => (
          <FollowupPanel application={application} followup={{ ...ready, queueRefused: false }} />
        )}
      </AiSectionBody>
    </ApplicationSection>
  );
}
