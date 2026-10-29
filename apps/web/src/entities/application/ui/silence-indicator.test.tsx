import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SilenceIndicator } from './silence-indicator';

describe('SilenceIndicator', () => {
  it('stays empty while the application is not going quiet', () => {
    const { container } = render(
      <SilenceIndicator application={{ daysSinceLastEvent: 9, silenceLevel: 'none' }} />,
    );

    expect(container.childElementCount).toBe(0);
  });

  it.each([
    { daysSinceLastEvent: 1, silenceLevel: 'warn', text: '1 день тиші' },
    { daysSinceLastEvent: 2, silenceLevel: 'warn', text: '2 дні тиші' },
    { daysSinceLastEvent: 5, silenceLevel: 'silent', text: '5 днів тиші' },
  ] as const)('$silenceLevel after $daysSinceLastEvent days reads "$text"', (row) => {
    const { container } = render(<SilenceIndicator application={row} />);

    expect(screen.getByText(row.text)).toBeDefined();
    expect(container.querySelector('svg.lucide-circle-dashed')).not.toBeNull();
  });
});
