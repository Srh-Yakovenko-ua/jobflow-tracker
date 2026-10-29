import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SubmitEvent } from 'react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';

import { Field } from './field';
import { TagInput } from './tag-input';

const COPY = uk.devUi.fields.tags;

function Tags({ initial }: Readonly<{ initial: string[] }>) {
  const [tags, setTags] = useState(initial);
  return (
    <Field label={COPY.label}>
      <TagInput value={tags} onValueChange={setTags} placeholder={COPY.placeholder} />
    </Field>
  );
}

function renderTags(initial: string[]) {
  const onSubmit = vi.fn((event: SubmitEvent) => {
    event.preventDefault();
  });
  render(
    <form onSubmit={onSubmit}>
      <Tags initial={initial} />
    </form>,
  );
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: COPY.label });
  return { user: userEvent.setup(), input, onSubmit };
}

function chipNames() {
  return screen.queryAllByRole('button').map((button) => button.getAttribute('aria-label'));
}

describe('TagInput', () => {
  it('Enter adds the trimmed draft as a chip once, empties the draft and never submits the form', async () => {
    const { user, input, onSubmit } = renderTags(['React']);

    await user.type(input, '  Kafka {Enter}React{Enter}');

    expect(chipNames()).toEqual([`${uk.ui.remove} React`, `${uk.ui.remove} Kafka`]);
    expect(input.value).toBe('');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Backspace edits a draft first and removes the last chip only once the draft is empty', async () => {
    const { user, input } = renderTags(['React', 'Kafka']);

    await user.type(input, 'ab{Backspace}{Backspace}');
    expect(chipNames()).toEqual([`${uk.ui.remove} React`, `${uk.ui.remove} Kafka`]);

    await user.keyboard('{Backspace}');
    expect(chipNames()).toEqual([`${uk.ui.remove} React`]);
  });

  it('a chip remove button drops that tag and gives focus back to the input', async () => {
    const { user, input } = renderTags(['React', 'Kafka']);

    await user.click(screen.getByRole('button', { name: `${uk.ui.remove} React` }));

    expect(chipNames()).toEqual([`${uk.ui.remove} Kafka`]);
    expect(document.activeElement).toBe(input);
  });

  it('the last chip remove hit area ends halfway into the gap, so the start of the input stays the input', () => {
    renderTags(['React']);

    const remove = screen.getByRole('button', { name: `${uk.ui.remove} React` }).className;
    expect(remove).toContain('after:left-auto');
    expect(remove).toContain('after:right-[-7px]');
  });
});
