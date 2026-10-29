import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';

import { RadioGroup } from './radio-group';

const COPY = uk.devUi.choice;

const SIDES = [
  { value: 'company', label: COPY.radios.company },
  { value: 'candidate', label: COPY.radios.mine },
];

describe('RadioGroup', () => {
  it('Tab lands on the checked option and ArrowDown checks the next one', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup
        aria-label={COPY.radioLabel}
        options={SIDES}
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
});
