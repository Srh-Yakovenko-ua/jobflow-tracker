import type { CardDensity } from '@/entities/application';

export const COLUMN_VIRTUAL = {
  threshold: 30,
  overscan: 6,
  gap: 10,
  estimate: { full: 120, compact: 92 } satisfies Record<CardDensity, number>,
} as const;
