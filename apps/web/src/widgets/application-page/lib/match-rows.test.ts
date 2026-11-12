import { describe, expect, it } from 'vitest';

import { DESIGN_MATCH } from '@/test/match-fixtures';

import { matchRowsOf } from './match-rows';

function breakdown() {
  if (DESIGN_MATCH.match === null) throw new Error('the design match has a breakdown');
  return DESIGN_MATCH.match;
}

function shown(rows: ReturnType<typeof matchRowsOf>['matched']) {
  return rows.map(({ name, mark, ignored }) => ({ name, mark, ignored }));
}

describe('matchRowsOf', () => {
  it('the design breakdown reads matched by coverage and missing by the points lost, the ignored item last and muted', () => {
    const rows = matchRowsOf(breakdown());

    expect(shown(rows.matched)).toEqual([
      { name: 'React + TypeScript, 6 років', mark: 'повний', ignored: false },
      { name: 'Node.js у проді', mark: 'повний', ignored: false },
      { name: 'GraphQL', mark: 'частковий', ignored: false },
      { name: 'Рівень англійської Upper-Int', mark: 'повний', ignored: false },
    ]);
    expect(shown(rows.missing)).toEqual([
      { name: 'AWS / інфраструктура', mark: '−14', ignored: false },
      { name: 'Досвід ліда команди 3+', mark: '−8', ignored: false },
      { name: 'Домен fintech', mark: 'не вплинуло', ignored: true },
    ]);
  });

  it('a covered item that did not count goes after the matched ones, not under the missing', () => {
    const rows = matchRowsOf({
      ...breakdown(),
      ignored: [
        { name: 'Kafka', coverage: 'partial' },
        { name: 'Docker', coverage: 'full' },
      ],
    });

    expect(shown(rows.matched).slice(-2)).toEqual([
      { name: 'Kafka', mark: 'не вплинуло', ignored: true },
      { name: 'Docker', mark: 'не вплинуло', ignored: true },
    ]);
    expect(rows.missing.map(({ name }) => name)).toEqual([
      'AWS / інфраструктура',
      'Досвід ліда команди 3+',
    ]);
  });

  it('every row has its own key, so a name in both lists stays two rows', () => {
    const rows = matchRowsOf({
      ...breakdown(),
      ignored: [{ name: 'GraphQL', coverage: 'missing' }],
    });
    const ids = [...rows.matched, ...rows.missing].map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
