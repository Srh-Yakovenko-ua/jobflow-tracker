export const CARD_DENSITIES = ['full', 'compact'] as const;

export type CardDensity = (typeof CARD_DENSITIES)[number];
