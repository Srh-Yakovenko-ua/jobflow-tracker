'use client';

import type { ScheduledEvent, Stage } from '@jobflow/shared';
import { useId, useState } from 'react';

import { type ApplicationCardContext, NextEventChip } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Field } from '@/shared/ui/field';
import { NumberInput } from '@/shared/ui/number-input';

import { useEventOutcomeMutation } from '../model/use-event-outcome-mutation';
import { DURATION_RANGE } from './schedule-form-fields';

export type EventOutcomeActions = Readonly<{
  onCompleted: (suggestedStage: Stage | null) => void;
  onReschedule: (event: ScheduledEvent) => void;
}>;

export type EventOutcomePromptProps = Readonly<{
  event: ScheduledEvent;
  context: ApplicationCardContext;
  actions: EventOutcomeActions;
}>;

const COPY = uk.applicationPage.schedule;

export function EventOutcomePrompt({ event, context, actions }: EventOutcomePromptProps) {
  const headingId = useId();
  const [durationMin, setDurationMin] = useState(event.durationMin);
  const { answering, answer } = useEventOutcomeMutation({
    event,
    onCompleted: actions.onCompleted,
  });
  const busy = answering !== null;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-lg bg-surface p-3.5 shadow-e1"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id={headingId} className="text-[14px] font-semibold text-ink">
          {COPY.outcome.question}
        </h2>
        <NextEventChip event={event} context={context} />
      </div>
      <div className="max-w-60">
        <Field label={COPY.fields.duration}>
          <NumberInput
            value={durationMin}
            onValueChange={setDurationMin}
            range={DURATION_RANGE}
            unit={COPY.minutes}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={answering === 'done'}
          disabled={busy}
          onClick={() => {
            answer({ status: 'done', durationMin });
          }}
        >
          {COPY.outcome.done}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            actions.onReschedule(event);
          }}
        >
          {COPY.outcome.rescheduled}
        </Button>
        <Button
          size="sm"
          variant="outline"
          loading={answering === 'cancelled'}
          disabled={busy}
          onClick={() => {
            answer({ status: 'cancelled' });
          }}
        >
          {COPY.outcome.cancelled}
        </Button>
      </div>
    </section>
  );
}
