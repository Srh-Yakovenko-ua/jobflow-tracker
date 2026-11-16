import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderViewInApp } from '@/test/render-in-app';

import { useKeptFocus } from './use-kept-focus';

function Comparison({ order }: Readonly<{ order: string }>) {
  const { containerRef, onFocus, onBlur } = useKeptFocus(order);
  return (
    <>
      <div ref={containerRef} onFocus={onFocus} onBlur={onBlur}>
        <button type="button">inside</button>
      </div>
      <p>outside</p>
    </>
  );
}

async function renderWithFocusInside() {
  const rendered = renderViewInApp(<Comparison order="a,b" />);
  const inside = screen.getByRole('button', { name: 'inside' });
  await rendered.user.click(inside);
  return { ...rendered, inside };
}

describe('useKeptFocus', () => {
  it('after a click outside the comparison a reorder does not pull focus back', async () => {
    const { user, view } = await renderWithFocusInside();
    await user.click(screen.getByText('outside'));
    expect(document.activeElement).toBe(document.body);

    view.rerender(<Comparison order="b,a" />);

    expect(document.activeElement).toBe(document.body);
  });

  it('a blur with no new target, as a moved node gets in a reorder, still brings focus back', async () => {
    const { view, inside } = await renderWithFocusInside();
    act(() => {
      inside.blur();
    });

    view.rerender(<Comparison order="b,a" />);

    expect(document.activeElement).toBe(inside);
  });
});
