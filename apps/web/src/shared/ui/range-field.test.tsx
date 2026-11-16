import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { axeViolations } from '@/test/axe';

import { RangeField } from './range-field';

function renderField() {
  const onValueChange = vi.fn<(value: number) => void>();
  const view = render(
    <RangeField
      label="Гроші"
      value={{ current: 3, shown: '3', spoken: '3 з 5' }}
      bounds={{ min: 0, max: 5, step: 1 }}
      onValueChange={onValueChange}
    />,
  );
  return { onValueChange, view };
}

describe('RangeField', () => {
  it('names the slider by its visible label and reads its value as words', () => {
    renderField();

    const slider = screen.getByRole('slider', { name: 'Гроші' });
    expect(slider.getAttribute('aria-valuetext')).toBe('3 з 5');
    expect([
      slider.getAttribute('min'),
      slider.getAttribute('max'),
      slider.getAttribute('step'),
    ]).toEqual(['0', '5', '1']);
    expect(screen.getByText('3').getAttribute('aria-hidden')).toBe('true');
  });

  it('passes the moved value on as a number', () => {
    const { onValueChange } = renderField();

    fireEvent.change(screen.getByRole('slider', { name: 'Гроші' }), { target: { value: '5' } });

    expect(onValueChange).toHaveBeenCalledWith(5);
  });

  it('gives the slider a 44 px hit zone at every width while its row keeps the drawn 32 px', () => {
    renderField();

    const { classList } = screen.getByRole('slider', { name: 'Гроші' });
    expect([classList.contains('h-11'), classList.contains('-my-1.5')]).toEqual([true, true]);
  });

  it('has no axe violations', async () => {
    const { view } = renderField();

    expect(await axeViolations(view.container)).toEqual([]);
  });
});
