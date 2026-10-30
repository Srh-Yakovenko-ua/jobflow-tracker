import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PromisePanel } from './promise-panel';

describe('the promise panel', () => {
  it('reads its three-line headline as one sentence with a space at each line break', () => {
    render(<PromisePanel />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Пошук роботи — це воронка, а не удача' }),
    ).toBeDefined();
  });
});
