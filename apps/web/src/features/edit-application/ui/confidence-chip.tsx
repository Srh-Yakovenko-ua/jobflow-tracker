'use client';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Tooltip } from '@/shared/ui/tooltip';

import type { FieldReview, ReviewedField, ReviewFields } from '../lib/review-fields';

export type ConfidenceChipProps = Readonly<{ field: ReviewedField; reviews: ReviewFields }>;

const COPY = uk.add.review;

export const REVIEW_NAMES: Readonly<Record<ReviewedField, string>> = {
  company: uk.add.manual.fields.company,
  position: uk.add.manual.fields.position,
  salary: COPY.salary(null),
  source: uk.add.manual.fields.source,
  stack: uk.applicationPage.editor.fields.stack,
};

const TONES: Readonly<Record<Exclude<FieldReview['confidence'], 'missing'>, string>> = {
  exact: 'text-offer',
  check: 'text-ink-2',
};

export function ConfidenceChip({ field, reviews }: ConfidenceChipProps) {
  const { confidence, quote } = reviews[field];
  if (confidence === 'missing') return null;
  const mark = COPY.confidence[confidence];
  return (
    <Tooltip
      side="right"
      content={
        <span className="wrap-anywhere whitespace-pre-wrap">{quote ?? COPY.evidenceMissing}</span>
      }
    >
      <button
        type="button"
        aria-label={COPY.chip(REVIEW_NAMES[field], mark)}
        className={cn(
          'touch-target flex-none cursor-help rounded-sm font-ui text-[10px] leading-[1.4] font-semibold transition-colors duration-(--duration-instant) ease-standard hover:text-ink',
          TONES[confidence],
        )}
      >
        {mark}
      </button>
    </Tooltip>
  );
}
