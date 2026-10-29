import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OutcomeBadge } from './outcome-badge';

describe('OutcomeBadge', () => {
  it.each([
    { outcome: 'offer', label: 'офер', ink: 'text-offer' },
    { outcome: 'rejected', label: 'відмова', ink: 'text-ink-2' },
    { outcome: 'ghosted', label: 'ghosted', ink: 'text-ink-3' },
    { outcome: 'withdrawn', label: 'відкликав', ink: 'text-ink-2' },
  ] as const)('$outcome shows the label "$label" in $ink beside a marker shape', (row) => {
    render(<OutcomeBadge outcome={row.outcome} />);

    const badge = screen.getByText(row.label);
    expect(badge.className).toContain(row.ink);
    expect(badge.querySelector('[aria-hidden]')).not.toBeNull();
  });

  it.each(['circle-minus', 'circle-dashed', 'circle-slash-2'])(
    'a closed outcome draws the %s marker so its state never rests on colour',
    (icon) => {
      const { container } = render(
        <>
          <OutcomeBadge outcome="rejected" />
          <OutcomeBadge outcome="ghosted" />
          <OutcomeBadge outcome="withdrawn" />
        </>,
      );

      expect(container.querySelector(`svg.lucide-${icon}`)).not.toBeNull();
    },
  );

  it('a rejection is never drawn in the danger red', () => {
    const { container } = render(<OutcomeBadge outcome="rejected" />);

    expect(container.querySelector('[class*="danger"]')).toBeNull();
  });
});
