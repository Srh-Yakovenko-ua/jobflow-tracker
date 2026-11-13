import type { ReasonsResponse, StageReasons } from '@jobflow/shared';
import { buildDesignReasons } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { rowTexts } from '@/test/table-rows';

import { reasonBarsOf } from './reason-bars';

const REJECTED = '/board?stage=rejected';

describe('reasonBarsOf', () => {
  it('lays the four stages out as the design does', () => {
    expect(reasonBarsOf(buildDesignReasons()).labels).toEqual([
      'відгук',
      'скринінг',
      "техінтерв'ю",
      'фінал',
    ]);
  });

  it('draws one series per stated reason in taxonomy order, labelled with its total, on its side stack', () => {
    const { datasets } = reasonBarsOf(buildDesignReasons());

    expect(datasets.map(({ label, stack }) => [label, stack])).toEqual([
      ['не вистачає скілів 6', 'company'],
      ['рівень англійської 4', 'company'],
      ['зарплатні очікування 3', 'company'],
      ['обрали іншого 3', 'company'],
      ['вакансію закрили 2', 'company'],
      ['без пояснення 2', 'company'],
      ['низька вилка 2', 'candidate'],
      ['офіс/графік 2', 'candidate'],
      ['ред флаги 2', 'candidate'],
      ['прийняв інший офер 2', 'candidate'],
    ]);
    expect(datasets[0]?.data).toEqual([3, 0, 3, 0]);
    expect(datasets[7]?.data).toEqual([1, 0, 0, 1]);
  });

  it('tooltips give the count, and the share only where the stage has five rejections or more', () => {
    const [skillsGap] = reasonBarsOf(buildDesignReasons()).datasets;

    expect(skillsGap?.tips).toEqual([
      ['не вистачає скілів: 3', '18% відмов етапу'],
      [],
      ['не вистачає скілів: 3'],
      [],
    ]);
  });

  it('the table names stage, side, reason, count and share, and no percent below five rejections', () => {
    const bars = reasonBarsOf(buildDesignReasons());
    const cells = rowTexts(bars.rows);

    expect(cells).toHaveLength(19);
    expect(cells[0]).toEqual(['відгук', 'компанія', 'не вистачає скілів', '3', '18%']);
    expect(cells.slice(15)).toEqual([
      [
        "техінтерв'ю",
        'компанія',
        'не вистачає скілів',
        '3',
        'мало даних · Ще 1 відгук до першого висновку',
      ],
      [
        "техінтерв'ю",
        'компанія',
        'рівень англійської',
        '1',
        'мало даних · Ще 1 відгук до першого висновку',
      ],
      ['фінал', 'ти', 'офіс/графік', '1', 'мало даних · Ще 3 відгуки до першого висновку'],
      ['фінал', 'ти', 'ред флаги', '1', 'мало даних · Ще 3 відгуки до першого висновку'],
    ]);
    expect(new Set(bars.rows.map(({ cells: [, , reason] }) => reason?.href))).toEqual(
      new Set([REJECTED]),
    );
  });

  it('leaves the unstated system codes out of the bars and the table', () => {
    const body = buildDesignReasons();
    const [applied, ...rest] = body.stages;
    if (applied === undefined) throw new Error('no applied stage');
    const silence: StageReasons['reasons'][number] = {
      code: 'silence_timeout',
      count: 2,
      share: applied.sides.company.share,
    };
    const withSilence: ReasonsResponse = {
      ...body,
      stages: [{ ...applied, reasons: [...applied.reasons, silence] }, ...rest],
    };

    const bars = reasonBarsOf(withSilence);

    expect(bars.datasets.map(({ code }) => code)).not.toContain('silence_timeout');
    expect(rowTexts(bars.rows).flat()).not.toContain('тиша');
  });

  it('a search without stated rejections has no series and no rows', () => {
    expect(reasonBarsOf({ stages: [], headline: null })).toEqual({
      labels: [],
      datasets: [],
      rows: [],
    });
  });
});
