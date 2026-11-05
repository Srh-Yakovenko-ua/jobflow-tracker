import { z } from 'zod';

import { CARD_DENSITIES, type CardDensity } from '@/entities/application';

export const BOARD_DENSITY_COOKIE = 'jobflow_board_density';

const boardDensityCookieSchema = z.enum(CARD_DENSITIES).catch('full');

export type BoardDensityState = Readonly<{ density: CardDensity }>;

export function boardDensityFromCookie(value: string | undefined): BoardDensityState {
  return { density: boardDensityCookieSchema.parse(value) };
}
