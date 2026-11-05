import { CARD_DENSITIES } from '@/entities/application';
import { uk } from '@/shared/i18n';

export const BOARD_DENSITY_OPTIONS = CARD_DENSITIES.map((density) => ({
  value: density,
  label: uk.board.density[density],
}));
