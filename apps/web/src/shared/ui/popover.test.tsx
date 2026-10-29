import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const COPY = uk.devUi.feedback;

describe('Popover', () => {
  it('Escape closes the open popover and focus goes back to its trigger', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary">{COPY.popoverTrigger}</Button>
        </PopoverTrigger>
        <PopoverContent aria-label={COPY.popoverTrigger}>{COPY.popoverText}</PopoverContent>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: COPY.popoverTrigger });

    await user.click(trigger);
    const popover = await screen.findByRole('dialog', { name: COPY.popoverTrigger });
    expect(popover.textContent).toBe(COPY.popoverText);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
