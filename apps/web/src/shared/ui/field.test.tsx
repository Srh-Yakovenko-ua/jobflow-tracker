import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { Field } from './field';
import { Input } from './input';
import { Textarea } from './textarea';

const COPY = uk.devUi.fields;

function messageRowOf(control: HTMLElement) {
  return document.getElementById(control.getAttribute('aria-describedby') ?? '');
}

function describedText(control: HTMLElement) {
  return messageRowOf(control)?.textContent;
}

function salaryField(error?: string) {
  return (
    <Field label={COPY.salary.label} footer={{ error }}>
      <Input />
    </Field>
  );
}

describe('Field', () => {
  it('the label names the input and the hint describes it', () => {
    render(
      <Field label={COPY.company.label} footer={{ hint: COPY.company.hint }}>
        <Input placeholder={COPY.company.placeholder} />
      </Field>,
    );

    const input = screen.getByRole('textbox', { name: COPY.company.label });
    expect(describedText(input)).toBe(COPY.company.hint);
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('an error replaces the hint, marks the input invalid and sits in a polite live region', () => {
    render(
      <Field
        label={COPY.salary.label}
        footer={{ hint: COPY.company.hint, error: COPY.salary.error }}
      >
        <Input />
      </Field>,
    );

    const input = screen.getByRole('textbox', { name: COPY.salary.label });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(describedText(input)).toBe(COPY.salary.error);
    expect(screen.getByText(COPY.salary.error).closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('the message row keeps its height with and without an error', () => {
    const { rerender } = render(salaryField());
    const input = screen.getByRole('textbox', { name: COPY.salary.label });
    const row = messageRowOf(input);
    expect(row).toBeInstanceOf(HTMLDivElement);
    expect(row?.classList.contains('min-h-lh')).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBeNull();

    rerender(salaryField(COPY.salary.error));

    expect(messageRowOf(input)).toBe(row);
    expect(row?.classList.contains('min-h-lh')).toBe(true);
    expect(row?.textContent).toBe(COPY.salary.error);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('a field with no footer renders no message row and no description', () => {
    const { container } = render(
      <Field label={COPY.company.label}>
        <Input />
      </Field>,
    );

    const input = screen.getByRole('textbox', { name: COPY.company.label });
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(container.querySelector('[aria-live]')).toBeNull();
  });

  it('the counter turns danger only above 95 percent of the limit', () => {
    const { rerender } = render(
      <Field label={COPY.note.label} footer={{ counter: { value: 190, max: 200 } }}>
        <Textarea />
      </Field>,
    );
    expect(screen.getByText('190 / 200').className).not.toContain('text-danger');

    rerender(
      <Field label={COPY.note.label} footer={{ counter: { value: 191, max: 200 } }}>
        <Textarea />
      </Field>,
    );
    expect(screen.getByText('191 / 200').className).toContain('text-danger');
  });
});
