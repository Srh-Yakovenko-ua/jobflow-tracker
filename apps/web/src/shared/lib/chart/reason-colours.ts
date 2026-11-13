import type { RejectionReasonCode } from '@jobflow/shared';

import type { ChartPalette } from './chart-options';

export function reasonColours(palette: ChartPalette): Record<RejectionReasonCode, string> {
  const { data, outcome, colors } = palette;
  return {
    skills_gap: outcome.rejected,
    chose_other: data[0],
    no_explanation: data[2],
    english_level: data[3],
    position_closed: data[4],
    salary_expectations: data[5],
    low_salary: data[1],
    office_schedule: outcome.withdrawn,
    accepted_other: outcome.offer,
    red_flags: colors['ink-3'],
    silence_timeout: colors['ink-3'],
    unspecified: colors['ink-3'],
  };
}
