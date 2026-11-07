import { describe, expect, it } from 'vitest';

import { fixtureIdOf } from '@/test/board-fixtures';

import { paletteFilter } from './palette-filter';

const ID = fixtureIdOf(301);

const TESTER = ['Тестувальник мобільних', 'Acme'];

const ROKU = ['Mobile Engineer', 'Roku'];

describe('paletteFilter', () => {
  it('keeps a row the server found at the fixed score, whatever was typed', () => {
    expect(paletteFilter(`found:${ID}`, 'zzz', [])).toBe(0.5);
  });

  it.each([
    { row: 'with no keywords, scored by its value', value: 'Дошка', search: 'дош', keywords: [] },
    {
      row: 'of «Недавні», on a run of its letters',
      value: `recent:${ID}`,
      search: 'rok',
      keywords: ROKU,
    },
    {
      row: 'of «Недавні», on the swapped layout',
      value: `recent:${ID}`,
      search: 'кщ',
      keywords: ROKU,
    },
    {
      row: 'of «Сторінки», on scattered letters',
      value: 'page:/x',
      search: 'тем',
      keywords: TESTER,
    },
  ])('shows a row $row', ({ value, search, keywords }) => {
    expect(paletteFilter(value, search, keywords)).toBeGreaterThan(0);
  });

  it('hides a row of «Недавні» whose letters are only scattered through it', () => {
    expect(paletteFilter(`recent:${ID}`, 'тем', TESTER)).toBe(0);
  });
});
