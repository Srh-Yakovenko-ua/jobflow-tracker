import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FirstRunState } from './first-run-state';

vi.mock('next/link', () => import('@/test/link'));

const INSTALL = { name: 'Встановити букмарклет' } as const;

describe('FirstRunState', () => {
  it('links to the bookmarklet install in the settings', () => {
    render(<FirstRunState />);

    expect(screen.getByRole('link', INSTALL).getAttribute('href')).toBe('/settings#bookmarklet');
  });

  it('offers Додати першу вакансію first, linked to /add', () => {
    render(<FirstRunState />);

    expect(
      screen.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Додати першу вакансію', '/add'],
      ['Встановити букмарклет', '/settings#bookmarklet'],
    ]);
  });

  it('both links keep the large button height and grow to 44 px under md', () => {
    render(<FirstRunState />);

    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toContain('max-md:min-h-11');
      expect(link.className).toMatch(/\bh-control-lg\b/);
    }
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
