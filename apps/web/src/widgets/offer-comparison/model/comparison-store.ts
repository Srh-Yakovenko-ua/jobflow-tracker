import { workModeSchema } from '@jobflow/shared';
import { z } from 'zod';

export const OFFER_CRITERIA = ['money', 'stack', 'format', 'growth', 'stability'] as const;

export const OFFER_BENEFITS = ['equipment', 'education', 'medical', 'vacation'] as const;

export const COMPARISON_LIMITS = {
  noteMaxLength: 1000,
  weightMax: 5,
  ratingMin: 1,
  ratingMax: 5,
} as const;

const noteSchema = z.string().max(COMPARISON_LIMITS.noteMaxLength);

const offerNotesSchema = z.object({
  notes: noteSchema,
  growthNote: noteSchema,
  growthRating: z
    .int()
    .min(COMPARISON_LIMITS.ratingMin)
    .max(COMPARISON_LIMITS.ratingMax)
    .nullable(),
  benefits: z.record(z.enum(OFFER_BENEFITS), z.boolean()),
});

export const comparisonSchema = z.object({
  weights: z.record(z.enum(OFFER_CRITERIA), z.int().min(0).max(COMPARISON_LIMITS.weightMax)),
  preferredMode: workModeSchema,
  offers: z.record(z.uuid(), offerNotesSchema),
});

export type OfferCriterion = (typeof OFFER_CRITERIA)[number];

export type OfferNotes = z.infer<typeof offerNotesSchema>;

export type Comparison = z.infer<typeof comparisonSchema>;

export type OfferWeights = Comparison['weights'];

export const EMPTY_OFFER_NOTES: OfferNotes = {
  notes: '',
  growthNote: '',
  growthRating: null,
  benefits: { equipment: false, education: false, medical: false, vacation: false },
};

export const DEFAULT_COMPARISON: Comparison = {
  weights: { money: 3, stack: 3, format: 3, growth: 3, stability: 3 },
  preferredMode: 'remote',
  offers: {},
};
