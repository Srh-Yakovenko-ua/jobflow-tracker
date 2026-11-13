import { REJECTION_REASON_CODES } from '@jobflow/shared';
import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { describe, expect, it } from 'vitest';

import { sankeyNodeColours } from './sankey-colours';

const { light, dark } = CHART_THEME;

const SCHEMES = [
  { scheme: 'light', palette: light },
  { scheme: 'dark', palette: dark },
];

describe('sankeyNodeColours', () => {
  it.each(SCHEMES)(
    'in $scheme paints the four open stages in their stage tokens',
    ({ palette }) => {
      const { stage } = palette;

      expect(
        ['applied', 'screening', 'tech_interview', 'final'].map(sankeyNodeColours(palette)),
      ).toEqual([stage.applied, stage.screening, stage.tech, stage.final]);
    },
  );

  it.each(SCHEMES)('in $scheme paints the four outcomes in their outcome tokens', ({ palette }) => {
    const { outcome } = palette;

    expect(['offer', 'rejected', 'ghosted', 'withdrawn'].map(sankeyNodeColours(palette))).toEqual([
      outcome.offer,
      outcome.rejected,
      outcome.ghosted,
      outcome.withdrawn,
    ]);
  });

  it.each(SCHEMES)(
    'in $scheme paints every rejection reason and "інші" in the clay of the rejected outcome',
    ({ palette }) => {
      const colourOf = sankeyNodeColours(palette);

      for (const node of [...REJECTION_REASON_CODES, 'other']) {
        expect(colourOf(node)).toBe(palette.outcome.rejected);
      }
    },
  );

  it.each(SCHEMES)('in $scheme paints "у процесі" in the quiet ink-3', ({ palette }) => {
    expect(sankeyNodeColours(palette)('in_progress')).toBe(palette.colors['ink-3']);
  });
});
