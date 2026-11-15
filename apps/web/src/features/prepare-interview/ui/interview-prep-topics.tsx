'use client';

import type { ApplicationResponse, InterviewPrepTopic } from '@jobflow/shared';
import { motion } from 'motion/react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { ROW } from '@/shared/ui/list-stagger';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { StaggeredList } from '@/shared/ui/staggered-list';
import { STATE_TEXT } from '@/shared/ui/state-text';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { InterviewPrepResult } from '../lib/interview-prep-view';
import { topicSourceOf } from '../lib/topic-source';
import { useTopicChecklist } from '../model/use-topic-checklist';

export type InterviewPrepTopicsProps = Readonly<{
  application: ApplicationResponse;
  result: InterviewPrepResult;
}>;

const COPY = uk.interviewPrep;

function TopicWhy({ topic }: Readonly<{ topic: InterviewPrepTopic }>) {
  const source = topicSourceOf(topic.basis);
  const label = COPY.why.of(topic.name);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="xs" className={TOUCH_HEIGHT} aria-label={label}>
          {COPY.why.trigger}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={label}
        className="flex w-73 max-w-[calc(100vw-16px)] origin-(--radix-popover-content-transform-origin) flex-col gap-2"
      >
        <p className="text-body wrap-anywhere text-ink-2">{topic.why}</p>
        <p className="flex flex-col gap-0.5">
          <span className={cn(STATE_TEXT.eyebrow, 'text-ink-3')}>
            {COPY.why.source[source.kind]}
          </span>
          <span className="text-[13px] font-semibold wrap-anywhere">{source.detail}</span>
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function InterviewPrepTopics({ application, result }: InterviewPrepTopicsProps) {
  const checklist = useTopicChecklist({
    applicationId: application.id,
    generatedAt: result.generatedAt,
  });
  return (
    <StaggeredList
      label={{ text: COPY.topicsTitle, marker: 'filled' }}
      className="flex flex-col gap-1"
    >
      {result.topics.map((topic, index) => (
        <motion.li
          key={topic.name}
          variants={ROW}
          className="flex flex-wrap items-center justify-between gap-x-3 pb-1 shadow-[inset_0_-1px_0_var(--line-soft)] last:pb-0 last:shadow-none"
        >
          <Checkbox
            label={<span className="text-[14px] font-semibold wrap-anywhere">{topic.name}</span>}
            checked={checklist.isChecked(index)}
            disabled={!checklist.ready}
            onCheckedChange={() => {
              checklist.toggle(index);
            }}
          />
          <TopicWhy topic={topic} />
        </motion.li>
      ))}
    </StaggeredList>
  );
}
