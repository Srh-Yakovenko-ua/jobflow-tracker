import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pencil } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { IconAction } from './icon-action';

const LABEL = uk.contact.edit;

describe('IconAction', () => {
  it('on keyboard focus shows its label as a tooltip and is announced by its name only, with no description repeating it', async () => {
    const user = userEvent.setup();
    render(<IconAction label={LABEL} icon={Pencil} />);

    await user.tab();

    expect((await screen.findByRole('tooltip')).textContent).toBe(LABEL);
    expect(screen.getByRole('button', { name: LABEL, description: '' })).toBe(
      document.activeElement,
    );
  });
});
