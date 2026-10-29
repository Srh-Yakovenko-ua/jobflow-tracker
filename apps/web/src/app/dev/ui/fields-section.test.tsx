import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { FieldsSection } from './fields-section';

const SEARCH = uk.devUi.fields.search;

const TAGS = uk.devUi.fields.tags;

describe('FieldsSection', () => {
  it('the tags hint counts the chips and turns back into the Enter hint once Backspace empties them', async () => {
    const user = userEvent.setup();
    render(<FieldsSection />);
    expect(screen.getByText(TAGS.count(3))).toBeDefined();

    await user.click(screen.getByRole('textbox', { name: TAGS.label }));
    await user.keyboard('{Backspace}{Backspace}{Backspace}');

    expect(screen.getByText(TAGS.hint)).toBeDefined();
  });

  it('the search clear button empties the query and gives focus back to the input', async () => {
    const user = userEvent.setup();
    render(<FieldsSection />);
    const search = screen.getByRole<HTMLInputElement>('textbox', { name: SEARCH.label });

    await user.type(search, 'acme');
    await user.click(screen.getByRole('button', { name: uk.ui.clear }));

    expect(search.value).toBe('');
    expect(document.activeElement).toBe(search);
  });
});
