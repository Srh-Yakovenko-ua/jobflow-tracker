import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StageChip } from './stage-chip';

describe('StageChip', () => {
  it.each([
    { stage: 'applied', label: 'відгук', colour: 'bg-stage-applied' },
    { stage: 'screening', label: 'скринінг', colour: 'bg-stage-screening' },
    { stage: 'tech_interview', label: "техінтерв'ю", colour: 'bg-stage-tech' },
    { stage: 'final', label: 'фінал', colour: 'bg-stage-final' },
  ] as const)('$stage keeps its label "$label" visible next to a $colour square', (row) => {
    render(<StageChip stage={row.stage} />);

    const chip = screen.getByText(row.label);
    expect(chip.querySelector('[aria-hidden]')?.className).toContain(row.colour);
  });
});
