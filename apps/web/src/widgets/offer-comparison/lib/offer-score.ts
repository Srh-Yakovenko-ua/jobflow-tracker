import type { ApplicationResponse, WorkMode } from '@jobflow/shared';

import { usdNetPerMonthOf } from '@/entities/application';

import {
  type Comparison,
  COMPARISON_LIMITS,
  EMPTY_OFFER_NOTES,
  OFFER_BENEFITS,
  OFFER_CRITERIA,
  type OfferCriterion,
  type OfferNotes,
} from '../model/comparison-store';

export type RankInput = Readonly<{
  offers: readonly ApplicationResponse[];
  comparison: Comparison;
}>;

export type ScoredOffer = Readonly<{
  offer: ApplicationResponse;
  usdNet: number | null;
  score: number | null;
}>;

type CriterionInput = Readonly<{
  offer: ApplicationResponse;
  notes: OfferNotes;
  usdNet: number | null;
  bestUsdNet: number;
  preferredMode: WorkMode;
}>;

const FORMAT_FIT: Record<WorkMode, Record<WorkMode, number>> = {
  remote: { remote: 1, hybrid: 0.5, office: 0 },
  hybrid: { remote: 0.5, hybrid: 1, office: 0.5 },
  office: { remote: 0, hybrid: 0.5, office: 1 },
};

const RATING_SPAN = COMPARISON_LIMITS.ratingMax - COMPARISON_LIMITS.ratingMin;

const CRITERION_SCORE: Record<OfferCriterion, (input: CriterionInput) => number> = {
  money: ({ usdNet, bestUsdNet }) =>
    usdNet === null || bestUsdNet === 0 ? 0 : usdNet / bestUsdNet,
  stack: ({ offer }) => (offer.matchScore ?? 0) / 100,
  format: ({ offer, preferredMode }) =>
    offer.workMode === null ? 0 : FORMAT_FIT[preferredMode][offer.workMode],
  growth: ({ notes }) =>
    notes.growthRating === null
      ? 0
      : (notes.growthRating - COMPARISON_LIMITS.ratingMin) / RATING_SPAN,
  stability: ({ notes }) =>
    OFFER_BENEFITS.filter((benefit) => notes.benefits[benefit]).length / OFFER_BENEFITS.length,
};

function weightedScore(input: CriterionInput, weights: Comparison['weights']): number | null {
  const total = OFFER_CRITERIA.reduce((sum, criterion) => sum + weights[criterion], 0);
  if (total === 0) return null;
  const weighted = OFFER_CRITERIA.reduce(
    (sum, criterion) => sum + weights[criterion] * CRITERION_SCORE[criterion](input),
    0,
  );
  return Math.round((100 * weighted) / total);
}

export function rankOffers({ offers, comparison }: RankInput): ScoredOffer[] {
  const usdNets = offers.map((offer) => usdNetPerMonthOf(offer));
  const bestUsdNet = Math.max(0, ...usdNets.map((usdNet) => usdNet ?? 0));
  const scored = offers.map((offer, index) => {
    const usdNet = usdNets[index] ?? null;
    const notes = comparison.offers[offer.id] ?? EMPTY_OFFER_NOTES;
    const input = { offer, notes, usdNet, bestUsdNet, preferredMode: comparison.preferredMode };
    return { offer, usdNet, score: weightedScore(input, comparison.weights) };
  });
  return scored.sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
}
