'use client';

import { STAGE_LABELS } from '@jobflow/shared';
import Link from 'next/link';

import { type ApplicationCardContext, NextEventChip } from '@/entities/application';

import type { UpcomingInterview } from '../lib/upcoming-interviews';

export type InterviewRowProps = Readonly<{
  interview: UpcomingInterview;
  context: ApplicationCardContext;
}>;

export function InterviewRow({ interview, context }: InterviewRowProps) {
  const { applicationId, company, stage, eventKind } = interview.extendedProps;
  return (
    <Link
      href={`/applications/${applicationId}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-surface p-4 shadow-e1 transition-[box-shadow,translate] duration-(--duration-fast) ease-standard hover:-translate-y-px hover:shadow-e2 active:translate-y-0"
    >
      <span className="min-w-0 flex-1 wrap-break-word">
        <span className="font-semibold text-ink">{company}</span>
        <span className="text-[13px] text-ink-2"> · {STAGE_LABELS[stage].labelUk}</span>
      </span>
      <NextEventChip event={{ kind: eventKind, startsAt: interview.start }} context={context} />
    </Link>
  );
}
