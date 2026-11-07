'use client';

import {
  type ApplicationResponse,
  type ScheduledEvent,
  type Stage,
  STAGE_LABELS,
} from '@jobflow/shared';
import { useId } from 'react';

import { type ApplicationCardContext, NextEventChip } from '@/entities/application';
import { useMoveApplicationMutation } from '@/features/move-application';
import { EventOutcomePrompt, IcsDownloadButton } from '@/features/schedule-event';
import { uk } from '@/shared/i18n';
import { NEW_TAB, webUrlOf } from '@/shared/lib/web-url';
import { Button } from '@/shared/ui/button';
import { LoadFailedPanel } from '@/shared/ui/error-panel';

import type { ApplicationPageActions } from '../model/use-application-page';
import { useApplicationSchedule } from '../model/use-application-schedule';

export type ApplicationScheduleProps = Readonly<{
  application: ApplicationResponse;
  actions: Pick<ApplicationPageActions, 'onReschedule' | 'onSuggest'>;
  suggestion: Stage | null;
}>;

type UpcomingEventProps = Readonly<{ event: ScheduledEvent; context: ApplicationCardContext }>;

type StageSuggestionProps = Readonly<{
  application: ApplicationResponse;
  suggestion: { stage: Stage; onDismiss: () => void };
}>;

const COPY = uk.applicationPage;

function EventLocation({ location }: Readonly<{ location: string | null }>) {
  if (location === null) return null;
  const href = webUrlOf(location);
  if (href === null)
    return <span className="min-w-0 truncate text-[13px] text-ink-2">{location}</span>;
  return (
    <a
      href={href}
      {...NEW_TAB}
      className="min-w-0 truncate text-[13px] text-link underline-offset-2 hover:underline"
    >
      {location}
    </a>
  );
}

function UpcomingEvent({ event, context }: UpcomingEventProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <NextEventChip event={event} context={context} />
      <EventLocation location={event.locationOrLink} />
      <IcsDownloadButton event={event} />
    </div>
  );
}

function StageSuggestion({ application, suggestion }: StageSuggestionProps) {
  const move = useMoveApplicationMutation();
  const statusId = useId();
  return (
    <div
      role="group"
      aria-labelledby={statusId}
      className="flex flex-wrap items-center gap-2.5 rounded-lg bg-surface p-3.5 shadow-e1"
    >
      <p id={statusId} role="status" className="text-[13px] text-ink-2">
        {COPY.schedule.outcome.recorded}
      </p>
      <Button
        size="sm"
        loading={move.isPending}
        onClick={() => {
          move.mutate(
            { application, toStage: suggestion.stage },
            { onSuccess: suggestion.onDismiss },
          );
        }}
      >
        {COPY.moveTo(STAGE_LABELS[suggestion.stage].labelUk)}
      </Button>
      <Button size="sm" variant="ghost" onClick={suggestion.onDismiss}>
        {COPY.schedule.later}
      </Button>
    </div>
  );
}

export function ApplicationSchedule({
  application,
  actions,
  suggestion,
}: ApplicationScheduleProps) {
  const { agenda, context, load } = useApplicationSchedule(application);
  if (load.pending) return null;
  if (load.failed) return <LoadFailedPanel onRetry={load.onRetry} />;
  const { upcoming, awaitingOutcome } = agenda;
  return (
    <div className="flex flex-col gap-3 empty:hidden">
      {upcoming && <UpcomingEvent event={upcoming} context={context} />}
      {awaitingOutcome && (
        <EventOutcomePrompt
          key={awaitingOutcome.id}
          event={awaitingOutcome}
          context={context}
          actions={{ onCompleted: actions.onSuggest, onReschedule: actions.onReschedule }}
        />
      )}
      {suggestion !== null && (
        <StageSuggestion
          application={application}
          suggestion={{
            stage: suggestion,
            onDismiss: () => {
              actions.onSuggest(null);
            },
          }}
        />
      )}
    </div>
  );
}
