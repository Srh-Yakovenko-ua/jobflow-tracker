import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { Tooltip } from './tooltip';

const COPY = uk.devUi.feedback;

describe('Tooltip', () => {
  it('shows its label when the trigger takes keyboard focus and Escape hides it', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content={COPY.tooltip}>
        <button type="button">{COPY.tooltipTrigger}</button>
      </Tooltip>,
    );

    await user.tab();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toBe(COPY.tooltip);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: COPY.tooltipTrigger }));
  });
});
