'use client';

import { ChevronDown } from 'lucide-react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { DisclosureButton, useDisclosure } from '@/shared/ui/disclosure';
import { Reveal } from '@/shared/ui/reveal';

import type { InterviewPrepResult } from '../lib/interview-prep-view';

export type PracticeQuestionsProps = Readonly<{ questions: InterviewPrepResult['questions'] }>;

type PracticeQuestion = InterviewPrepResult['questions'][number];

const COPY = uk.interviewPrep;

type QuestionRowProps = Readonly<{ practice: PracticeQuestion }>;

function QuestionRow({ practice }: QuestionRowProps) {
  const disclosure = useDisclosure();
  return (
    <li className="flex flex-col shadow-[inset_0_-1px_0_var(--line-soft)] last:shadow-none">
      <button
        type="button"
        {...disclosure.toggle}
        className="flex min-h-11 items-center justify-between gap-3 rounded-sm text-left text-[14px] leading-[1.45] font-semibold wrap-anywhere transition-colors duration-(--duration-instant) ease-standard hover:text-link active:text-link"
      >
        {practice.question}
        <ChevronDown
          aria-hidden
          size={16}
          strokeWidth={1.9}
          className={cn(
            'flex-none text-ink-3 transition-transform duration-(--duration-base) ease-standard',
            disclosure.shown && 'rotate-180',
          )}
        />
      </button>
      <div id={disclosure.regionId}>
        <Reveal shown={disclosure.shown}>
          <p className="pb-3 text-[13px] leading-[1.55] wrap-anywhere text-ink-2">
            {COPY.hint(practice.hint)}
          </p>
        </Reveal>
      </div>
    </li>
  );
}

export function PracticeQuestions({ questions }: PracticeQuestionsProps) {
  const disclosure = useDisclosure();
  return (
    <div className="flex flex-col items-start gap-1.5">
      <DisclosureButton disclosure={disclosure} labels={COPY.questions} />
      <div id={disclosure.regionId} className="self-stretch">
        <Reveal shown={disclosure.shown}>
          <ul aria-label={COPY.questionsTitle} className="flex flex-col">
            {questions.map((practice) => (
              <QuestionRow key={practice.question} practice={practice} />
            ))}
          </ul>
        </Reveal>
      </div>
    </div>
  );
}
