import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { describe, expect, it } from 'vitest';

import { reasonColours } from './reason-colours';

const SCHEMES = [
  { scheme: 'light', palette: CHART_THEME.light },
  { scheme: 'dark', palette: CHART_THEME.dark },
];

describe('reasonColours', () => {
  it.each(SCHEMES)(
    'in $scheme paints the company reasons as the design does, skills gap in rejection clay',
    ({ palette }) => {
      const colours = reasonColours(palette);
      const { data, outcome } = palette;

      expect([
        colours.skills_gap,
        colours.chose_other,
        colours.no_explanation,
        colours.english_level,
        colours.position_closed,
        colours.salary_expectations,
      ]).toEqual([outcome.rejected, data[0], data[2], data[3], data[4], data[5]]);
    },
  );

  it.each(SCHEMES)(
    'in $scheme gives the candidate reasons their own tokens and quiets the system ones',
    ({ palette }) => {
      const colours = reasonColours(palette);
      const { data, outcome, colors } = palette;

      expect([
        colours.low_salary,
        colours.office_schedule,
        colours.accepted_other,
        colours.red_flags,
        colours.silence_timeout,
        colours.unspecified,
      ]).toEqual([
        data[1],
        outcome.withdrawn,
        outcome.offer,
        colors['ink-3'],
        colors['ink-3'],
        colors['ink-3'],
      ]);
    },
  );
});
