import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';

import { RadioGroup } from './radio-group';
import { SIDE_OPTIONS } from './specimen-options';

const COPY = uk.devUi.choice;

describe('RadioGroup', () => {
  it('Tab lands on the checked option and ArrowDown checks the next one', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup
        aria-label={COPY.radioLabel}
        options={SIDE_OPTIONS}
        value="company"
        onValueChange={onValueChange}
      />,
    );

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: COPY.radios.company }));
    await user.keyboard('{ArrowDown>}');

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledExactlyOnceWith('candidate');
    });
    expect(screen.getByRole('radiogroup', { name: COPY.radioLabel })).toBeDefined();
  });

  it('every 18 px radio carries the 44 px touch target', () => {
    render(
      <RadioGroup
        aria-label={COPY.radioLabel}
        options={SIDE_OPTIONS}
        value="company"
        onValueChange={vi.fn()}
      />,
    );

    const targets = screen.getAllByRole('radio').map((radio) => radio.className);
    expect(targets.filter((className) => className.includes('touch-target'))).toHaveLength(2);
  });
});
