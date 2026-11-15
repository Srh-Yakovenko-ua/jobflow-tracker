import { describe, expect, it } from 'vitest';

import { tokens, withColor } from '../test/tokens.js';
import { contrastRows, TEXT_PAIRS } from './contrast.js';
import { parseTokens } from './schema.js';

type Rows = ReturnType<typeof contrastRows>;

function ratioOf(rows: Rows, pair: string): number | undefined {
  return rows.find((row) => `${row.theme} ${row.text} on ${row.background}` === pair)?.ratio;
}

function failingOf(rows: Rows): string[] {
  return rows
    .filter((row) => row.result === 'FAIL')
    .map((row) => `${row.theme} ${row.text} on ${row.background}`);
}

describe('text contrast over tokens.json', () => {
  it('passes 4.5:1 for every text pair in light and dark', () => {
    const rows = contrastRows(tokens);

    expect(TEXT_PAIRS).toHaveLength(36);
    expect(rows).toHaveLength(68);
    expect(new Set(rows.map((row) => row.minimum))).toEqual(new Set([4.5]));
    expect(failingOf(rows)).toEqual([]);
  });

  it('measures ink-3 at 5.58 on light paper and 4.95 on dark surface-2', () => {
    const rows = contrastRows(tokens);

    expect(ratioOf(rows, 'light ink-3 on paper')).toBeCloseTo(5.58, 2);
    expect(ratioOf(rows, 'dark ink-3 on surface-2')).toBeCloseTo(4.95, 2);
  });

  it('checks the accent-press hover pair only in the theme that draws it', () => {
    const rows = contrastRows(tokens);

    expect(ratioOf(rows, 'light surface on accent-press')).toBeCloseTo(7.62, 2);
    expect(ratioOf(rows, 'dark surface on accent-press')).toBeUndefined();
    expect(ratioOf(rows, 'dark paper on accent-press')).toBeCloseTo(5.13, 2);
    expect(ratioOf(rows, 'light paper on accent-press')).toBeUndefined();
  });

  it('measures the danger button on its tint, composited over the surface it sits on', () => {
    const rows = contrastRows(tokens);

    expect(ratioOf(rows, 'light danger on danger/6 over surface-2')).toBeCloseTo(6.23, 2);
    expect(ratioOf(rows, 'light danger on danger/10 over surface-2')).toBeCloseTo(5.88, 2);
    expect(ratioOf(rows, 'dark danger on danger/6 over surface')).toBeCloseTo(4.97, 2);
    expect(ratioOf(rows, 'dark danger on danger/10 over surface')).toBeCloseTo(4.65, 2);
    expect(ratioOf(rows, 'dark danger on danger/6 over surface-2')).toBeUndefined();
  });

  it('fails the danger tint when a paler light danger brings it under 4.5:1', () => {
    const faded = withColor('danger', { oklch: 'oklch(55% 0.10 34)', hex: '#A85F4D' });

    expect(failingOf(contrastRows(faded))).toContain('light danger on danger/10 over surface-2');
  });

  it('fails a light ink-3 lifted too close to the paper', () => {
    const lifted = withColor('ink-3', { oklch: 'oklch(70% 0.010 70)', hex: '#A39E96' });

    expect(failingOf(contrastRows(lifted))).toEqual([
      'light ink-3 on paper',
      'light ink-3 on surface',
      'light ink-3 on surface-2',
      'light ink-3 on surface-3',
    ]);
  });

  it('refuses a pair whose text token tokens.json does not declare', () => {
    const color = Object.fromEntries(
      Object.entries(tokens.color).filter(([name]) => name !== 'link'),
    );

    expect(() => contrastRows(parseTokens({ ...tokens, color }))).toThrow('link');
  });
});
