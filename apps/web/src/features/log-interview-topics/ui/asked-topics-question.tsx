'use client';

import { NOTE_TOPIC_LABELS, NOTE_TOPICS, type NoteTopic } from '@jobflow/shared';
import { Check } from 'lucide-react';
import { useId, useState } from 'react';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Reveal } from '@/shared/ui/reveal';
import { ToggleChip } from '@/shared/ui/toggle-chip';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { type AskedTopicsInput, useAskedTopics } from '../model/use-asked-topics';

export type AskedTopicsQuestionProps = AskedTopicsInput;

const COPY = uk.interviewPrep.asked;

function toggled(picked: readonly NoteTopic[], topic: NoteTopic): NoteTopic[] {
  return picked.includes(topic)
    ? picked.filter((other) => other !== topic)
    : NOTE_TOPICS.filter((other) => other === topic || picked.includes(other));
}

export function AskedTopicsQuestion(props: AskedTopicsQuestionProps) {
  const titleId = useId();
  const asked = useAskedTopics(props);
  const [picked, setPicked] = useState<readonly NoteTopic[]>([]);
  return (
    <Reveal shown={asked.open}>
      <div className="flex flex-col gap-2.5 pt-2.5">
        <p id={titleId} className="text-[13px] font-semibold text-ink">
          {COPY.title}
        </p>
        <div role="group" aria-labelledby={titleId} className="flex flex-wrap gap-1.25">
          {NOTE_TOPICS.map((topic) => {
            const on = picked.includes(topic);
            return (
              <ToggleChip
                key={topic}
                pressed={on}
                onClick={() => {
                  setPicked(toggled(picked, topic));
                }}
              >
                {on && (
                  <Check aria-hidden size={14} strokeWidth={1.9} className="animate-check-in" />
                )}
                {NOTE_TOPIC_LABELS[topic].labelUk}
              </ToggleChip>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className={TOUCH_HEIGHT}
            disabled={picked.length === 0}
            loading={asked.saving}
            onClick={() => {
              asked.save(picked);
            }}
          >
            {COPY.save}
          </Button>
          <Button variant="ghost" size="sm" className={TOUCH_HEIGHT} onClick={asked.skip}>
            {COPY.skip}
          </Button>
        </div>
      </div>
    </Reveal>
  );
}
