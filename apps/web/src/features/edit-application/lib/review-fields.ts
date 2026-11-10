import {
  type ApplicationResponse,
  type VacancyConfidence,
  type VacancyParseOutput,
  vacancyParseOutputSchema,
} from '@jobflow/shared';

import { evidenceQuoteOf } from './field-evidence';

export const REVIEWED_FIELDS = ['company', 'position', 'salary', 'source', 'stack'] as const;

export type ReviewedField = (typeof REVIEWED_FIELDS)[number];

export type FieldReview = Readonly<{ confidence: VacancyConfidence; quote: string | null }>;

export type ReviewFields = Readonly<Record<ReviewedField, FieldReview>>;

type ParsedField = VacancyParseOutput[keyof VacancyParseOutput];

const DOUBT: Record<VacancyConfidence, number> = { missing: 0, exact: 1, check: 2 };

const MISSING: FieldReview = { confidence: 'missing', quote: null };

export const NO_REVIEW: ReviewFields = {
  company: MISSING,
  position: MISSING,
  salary: MISSING,
  source: MISSING,
  stack: MISSING,
};

function mostDoubted(reviews: readonly FieldReview[]): FieldReview {
  return reviews.reduce(
    (worst, review) => (DOUBT[review.confidence] > DOUBT[worst.confidence] ? review : worst),
    MISSING,
  );
}

export function reviewFieldsOf(application: ApplicationResponse): ReviewFields | null {
  const parsed = vacancyParseOutputSchema.safeParse(application.aiParsed);
  if (!parsed.success) return null;
  const { rawText } = application;
  const reviewOf = ({ confidence, evidence }: ParsedField): FieldReview => ({
    confidence,
    quote: evidenceQuoteOf({ rawText, evidence }),
  });
  const { company, position, salaryMin, salaryMax, currency, sourceGuess, stack } = parsed.data;
  return {
    company: reviewOf(company),
    position: reviewOf(position),
    salary: mostDoubted([salaryMin, salaryMax, currency].map(reviewOf)),
    source: reviewOf(sourceGuess),
    stack: reviewOf(stack),
  };
}
