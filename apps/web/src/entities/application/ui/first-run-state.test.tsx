import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FirstRunState } from './first-run-state';

vi.mock('next/link', () => import('@/test/link'));

const INSTALL = { name: 'Встановити букмарклет' } as const;

describe('FirstRunState', () => {
  it('with no action of its own links to the bookmarklet install in the settings', () => {
    render(<FirstRunState />);

    expect(screen.getByRole('link', INSTALL).getAttribute('href')).toBe('/settings#aiPrivacy');
  });

  it('with no action of its own offers Додати першу вакансію first, linked to /add', () => {
    render(<FirstRunState />);

    expect(
      screen.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Додати першу вакансію', '/add'],
      ['Встановити букмарклет', '/settings#aiPrivacy'],
    ]);
  });

  it('shows the action it is given instead of the install link', () => {
    render(<FirstRunState action={<button type="button">Додати першу вакансію</button>} />);

    expect(screen.getByRole('button', { name: 'Додати першу вакансію' })).toBeDefined();
    expect(screen.queryByRole('link', INSTALL)).toBeNull();
  });

  it('loads in the server graph, where the button helper is a client reference that refuses a call', async () => {
    vi.resetModules();
    vi.doMock('@/shared/ui/button', async (original) => ({
      ...(await original<typeof import('@/shared/ui/button')>()),
      buttonLinkClasses: () => {
        throw new Error('Attempted to call buttonLinkClasses() from the server');
      },
    }));

    await expect(import('./first-run-state')).resolves.toHaveProperty('FirstRunState');

    vi.doUnmock('@/shared/ui/button');
  });
});
