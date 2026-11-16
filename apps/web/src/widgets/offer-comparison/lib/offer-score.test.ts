import { buildDesignOffers } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import {
  type Comparison,
  DEFAULT_COMPARISON,
  EMPTY_OFFER_NOTES,
  type OfferWeights,
} from '../model/comparison-store';
import { rankOffers } from './offer-score';

const OFFERS = buildDesignOffers(4).map((offer) => ({ ...offer, aiStatus: null }));

const [TRIDENT, NORTHWIND, LUMEN] = OFFERS;

const ONLY_FORMAT: OfferWeights = { money: 0, stack: 0, format: 5, growth: 0, stability: 0 };

function rankedBy(comparison: Comparison, offers = OFFERS) {
  return rankOffers({ offers, comparison }).map(({ offer, score }) => [offer.company, score]);
}

function withWeights(weights: OfferWeights): Comparison {
  return { ...DEFAULT_COMPARISON, weights };
}

describe('rankOffers', () => {
  it('equal weights rank by salary share, Match Score and a remote fit, unrated growth and no benefits scoring 0', () => {
    expect(rankedBy(DEFAULT_COMPARISON)).toEqual([
      ['Trident Systems', 56],
      ['Northwind Labs', 33],
      ['Orbit Health', 32],
      ['Lumen Pay', 29],
    ]);
  });

  it('money at 0 and stack at 5 lifts the offer with the better stack over a richer one', () => {
    expect(
      rankedBy(withWeights({ money: 0, stack: 5, format: 3, growth: 3, stability: 3 })),
    ).toEqual([
      ['Trident Systems', 50],
      ['Orbit Health', 43],
      ['Northwind Labs', 33],
      ['Lumen Pay', 11],
    ]);
  });

  it('a growth rating and ticked benefits count: 5 of 5 and all four benefits score both in full', () => {
    if (!NORTHWIND || !LUMEN) throw new Error('the design offers lost an offer');
    const comparison: Comparison = {
      ...DEFAULT_COMPARISON,
      offers: {
        [LUMEN.id]: {
          ...EMPTY_OFFER_NOTES,
          growthRating: 5,
          benefits: { equipment: true, education: true, medical: true, vacation: true },
        },
        [NORTHWIND.id]: {
          ...EMPTY_OFFER_NOTES,
          growthRating: 3,
          benefits: { equipment: true, education: false, medical: true, vacation: false },
        },
      },
    };

    expect(rankedBy(comparison)).toEqual([
      ['Lumen Pay', 69],
      ['Trident Systems', 56],
      ['Northwind Labs', 53],
      ['Orbit Health', 32],
    ]);
  });

  it('a preferred office fits an office fully, hybrid by half and remote not at all', () => {
    expect(rankedBy({ ...withWeights(ONLY_FORMAT), preferredMode: 'office' })).toEqual([
      ['Northwind Labs', 100],
      ['Lumen Pay', 50],
      ['Trident Systems', 0],
      ['Orbit Health', 0],
    ]);
  });

  it('a tie keeps the list order, whichever offer comes first', () => {
    const reversed = [...OFFERS].reverse();

    expect(rankedBy(withWeights(ONLY_FORMAT))).toEqual([
      ['Trident Systems', 100],
      ['Orbit Health', 100],
      ['Lumen Pay', 50],
      ['Northwind Labs', 0],
    ]);
    expect(rankedBy(withWeights(ONLY_FORMAT), reversed).slice(0, 2)).toEqual([
      ['Orbit Health', 100],
      ['Trident Systems', 100],
    ]);
  });

  it('every weight at 0 gives no score and keeps the list order', () => {
    const zero = withWeights({ money: 0, stack: 0, format: 0, growth: 0, stability: 0 });

    expect(rankedBy(zero)).toEqual([
      ['Trident Systems', null],
      ['Northwind Labs', null],
      ['Lumen Pay', null],
      ['Orbit Health', null],
    ]);
  });

  it('carries the USD net figure each offer was scored on, null when it is not converted', () => {
    const ranked = rankOffers({
      offers: TRIDENT ? [{ ...TRIDENT, currency: 'GBP' }, ...OFFERS.slice(1)] : [],
      comparison: DEFAULT_COMPARISON,
    });

    expect(ranked.map(({ offer, usdNet }) => [offer.company, usdNet])).toEqual([
      ['Trident Systems', null],
      ['Northwind Labs', 3581],
      ['Orbit Health', null],
      ['Lumen Pay', 4819],
    ]);
  });
});
