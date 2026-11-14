'use client';

import Link from 'next/link';

import { uk } from '@/shared/i18n';
import { type AnalyticsBlock, analyticsHref } from '@/shared/lib/analytics-anchors';
import { cn } from '@/shared/lib/cn';
import { Tooltip } from '@/shared/ui/tooltip';

import { summaryParagraphsOf, type SummaryPart } from '../lib/summary-text';

const COPY = uk.summary;

export type SummaryTextMode = 'page' | 'block';

const PARAGRAPH: Record<SummaryTextMode, string> = {
  page: 'max-w-[68ch] text-[17px] leading-[1.7]',
  block: 'text-[14px] leading-[1.68]',
};

const NUMBER_LINK =
  'rounded-[4px] bg-accent-tint px-0.75 font-semibold text-ink tabular-nums underline decoration-link/60 underline-offset-3 transition-[background-color,text-decoration-color] duration-(--duration-instant) ease-standard hover:bg-surface-2 hover:decoration-link active:bg-surface-3';

type LinkedNumberProps = Readonly<{ text: string; block: AnalyticsBlock }>;

function LinkedNumber({ text, block }: LinkedNumberProps) {
  const label = COPY.chartLink(COPY.blocks[block]);
  return (
    <Tooltip content={label}>
      <Link href={analyticsHref(block)} className={NUMBER_LINK}>
        {text}
        <span className="sr-only">{`, ${label}`}</span>
      </Link>
    </Tooltip>
  );
}

function PartOf({ part }: Readonly<{ part: SummaryPart }>) {
  if (part.block === null) return part.text;
  return <LinkedNumber text={part.text} block={part.block} />;
}

export type SummaryTextProps = Readonly<{ text: string; view: { mode: SummaryTextMode } }>;

export function SummaryText({ text, view }: SummaryTextProps) {
  return summaryParagraphsOf(text).map((paragraph) => (
    <p key={paragraph.id} className={cn('text-pretty text-ink-2', PARAGRAPH[view.mode])}>
      {paragraph.parts.map((part) => (
        <PartOf key={part.id} part={part} />
      ))}
    </p>
  ));
}
