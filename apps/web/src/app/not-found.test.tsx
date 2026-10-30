import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import NotFound from './not-found';

describe('the 404 page', () => {
  it('says in Ukrainian that the page does not exist, that the data is safe, and links to the board', () => {
    render(<NotFound />);

    expect(screen.getByRole('heading', { level: 1, name: 'Сторінку не знайдено' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Такої сторінки немає' })).toBeDefined();
    expect(screen.getByText('Помилка 404')).toBeDefined();
    expect(
      screen.getByText('Посилання могло застаріти або змінитися. Усі твої дані на місці.'),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'На дошку' }).getAttribute('href')).toBe('/board');
  });
});
