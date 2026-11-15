'use client';

import type { ApplicationResponse, InterviewPrepStep } from '@jobflow/shared';
import { motion } from 'motion/react';
import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { ROW } from '@/shared/ui/list-stagger';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { StaggeredList } from '@/shared/ui/staggered-list';

import type { InterviewPrepResult } from '../lib/interview-prep-view';
import { InterviewPrepTopics } from './interview-prep-topics';
import { PracticeQuestions } from './practice-questions';

export type InterviewPrepPackProps = Readonly<{
  application: ApplicationResponse;
  result: InterviewPrepResult;
}>;

type PackListProps = Readonly<{ title: string; rows: readonly string[] }>;

type PlanLength = keyof typeof COPY.plans.options;

const COPY = uk.interviewPrep;

const PLAN_OPTIONS = (['plan30', 'plan120'] as const).map((plan) => ({
  value: plan,
  label: COPY.plans.options[plan],
}));

const LIST = 'flex flex-col gap-3';

const ROW_LOOK =
  'flex flex-col gap-1 pb-3 shadow-[inset_0_-1px_0_var(--line-soft)] last:pb-0 last:shadow-none';

function PackList({ title, rows }: PackListProps) {
  return (
    <StaggeredList label={{ text: title, marker: 'filled' }} className={LIST}>
      {rows.map((row) => (
        <motion.li key={row} variants={ROW} className={ROW_LOOK}>
          <span className="text-[14px] leading-[1.45] font-semibold wrap-anywhere">{row}</span>
        </motion.li>
      ))}
    </StaggeredList>
  );
}

function StepList({
  title,
  steps,
}: Readonly<{ title: string; steps: readonly InterviewPrepStep[] }>) {
  return (
    <StaggeredList label={{ text: title, marker: 'filled' }} className={LIST}>
      {steps.map(({ minutes, task }) => (
        <motion.li
          key={task}
          variants={ROW}
          className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-baseline gap-3 text-[14px] leading-[1.5]"
        >
          <span className="font-ui text-[12.5px] font-semibold text-ink-2 tabular-nums">
            {COPY.minutes(minutes)}
          </span>
          <span className="wrap-anywhere">{task}</span>
        </motion.li>
      ))}
    </StaggeredList>
  );
}

function PlanSwitch({ result }: Pick<InterviewPrepPackProps, 'result'>) {
  const [plan, setPlan] = useState<PlanLength>('plan30');
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        aria-label={COPY.plans.label}
        options={PLAN_OPTIONS}
        value={plan}
        onValueChange={setPlan}
      />
      <StepList key={plan} title={COPY.plans.title[plan]} steps={result[plan]} />
    </div>
  );
}

export function InterviewPrepPack({ application, result }: InterviewPrepPackProps) {
  return (
    <div className="flex flex-col gap-6">
      <InterviewPrepTopics application={application} result={result} />
      <PracticeQuestions questions={result.questions} />
      <PackList title={COPY.askCompanyTitle} rows={result.askCompany} />
      <PlanSwitch result={result} />
    </div>
  );
}
