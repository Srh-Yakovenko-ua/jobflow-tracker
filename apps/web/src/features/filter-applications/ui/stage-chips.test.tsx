import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FiltersStoreProvider } from '../model/filters-store';
import { StageChips } from './stage-chips';

describe('StageChips', () => {
  it('a picked chip switches its text to paper on hover in dark, keeping 4.5:1 on accent-press', () => {
    render(
      <FiltersStoreProvider initial={{ stage: ['applied'] }}>
        <StageChips applications={[]} />
      </FiltersStoreProvider>,
    );

    const { className } = screen.getByRole('button', { pressed: true });
    expect(className.split(' ')).toEqual(
      expect.arrayContaining([
        'hover:bg-accent-press',
        'dark:hover:text-paper',
        'dark:active:text-paper',
      ]),
    );
  });
});
