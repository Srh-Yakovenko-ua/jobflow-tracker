import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Reveal } from './reveal';

function renderReveal({ shown }: Readonly<{ shown: boolean }>) {
  const view = render(<Reveal shown={shown}>{<button type="button">Save</button>}</Reveal>);
  const save = () => screen.queryByRole('button', { name: 'Save', hidden: true });
  const show = ({ shown: next }: Readonly<{ shown: boolean }>) => {
    view.rerender(<Reveal shown={next}>{<button type="button">Save</button>}</Reveal>);
  };
  return { save, show };
}

describe('Reveal', () => {
  it('a block mounts when shown and is gone once it has collapsed', async () => {
    const { save, show } = renderReveal({ shown: false });
    expect(save()).toBeNull();

    show({ shown: true });
    expect(save()).not.toBeNull();
    show({ shown: false });

    await waitFor(() => {
      expect(save()).toBeNull();
    });
  });

  it('while it collapses the block is inert, so its buttons leave the tab order', () => {
    const { save, show } = renderReveal({ shown: true });
    expect(save()?.closest('[inert]')).toBeNull();

    show({ shown: false });

    expect(save()?.closest('[inert]')).toBeInstanceOf(HTMLElement);
  });

  it('at rest after opening the block does not clip its content, so focus rings show', async () => {
    const { save, show } = renderReveal({ shown: false });

    show({ shown: true });

    await waitFor(() => {
      expect(save()?.parentElement?.style.opacity).toBe('1');
    });
    expect(save()?.parentElement?.classList.contains('overflow-clip')).toBe(false);
  });

  it('as a span the block stays phrasing content, so it can fold a title inside a heading', () => {
    render(
      <Reveal shown view={{ as: 'span' }}>
        {<button type="button">Save</button>}
      </Reveal>,
    );

    expect(screen.getByRole('button', { name: 'Save' }).parentElement?.tagName).toBe('SPAN');
  });
});
