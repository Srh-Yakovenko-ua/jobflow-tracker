import { buildDesignSalary, buildNoSalary } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { barsOf, plottedOf, tableOf, textsOf } from '@/test/evidence-view';

import { salaryBarsOf } from './salary-bars';

const SPACE = ' ';

describe('salaryBarsOf', () => {
  it('plots offer, salary rejection and the rest at the median of their ranges with the full range as the whisker, in outcome colours', () => {
    const view = salaryBarsOf(buildDesignSalary());
    const { rows } = plottedOf(view).chart;

    expect(barsOf(view)).toEqual([
      ['офер / 1 відгук', 5800, [5800, 5800]],
      ['відмова через зарплату / 2 відгуки', 3950, [3800, 4100]],
      ['інші / 4 відгуки', 5050, [4500, 6000]],
    ]);
    expect(rows.map(({ colour }) => colour)).toEqual(['offer', 'rejected', 1]);
  });

  it('reads the axis in thousands of dollars and the tooltip as the median and the range in dollars', () => {
    const { rows, scale } = plottedOf(salaryBarsOf(buildDesignSalary())).chart;

    expect([0, 4000, 6000].map(scale.tick)).toEqual(['$0k', '$4k', '$6k']);
    expect(scale.format(4900)).toBe(`$4${SPACE}900`);
    expect(scale.step).toBe(1000);
    expect(rows[1]?.tip).toEqual([
      `$3${SPACE}950 · медіана`,
      `вилки від $3${SPACE}800 до $4${SPACE}100`,
    ]);
  });

  it('notes the median of every range and how many applications are left out, and sends groups under five to the small sample note', () => {
    const view = plottedOf(salaryBarsOf({ ...buildDesignSalary(), unconverted: 1 }));

    expect(textsOf(view.notes)).toEqual([
      `$4${SPACE}900 медіана вилки`,
      '3 відгуки без вилки не входять у розрахунок.',
      '1 відгук у валюті без курсу не входить у розрахунок.',
    ]);
    expect(textsOf(view.small)).toEqual([
      'офер: 1 відгук. На такій вибірці медіана лише орієнтир.',
      'відмова через зарплату: 2 відгуки. На такій вибірці медіана лише орієнтир.',
      'інші: 4 відгуки. На такій вибірці медіана лише орієнтир.',
    ]);
  });

  it('a group of five keeps out of the small sample note, and nothing left out adds no line', () => {
    const design = buildDesignSalary();
    const [offer, ...rest] = design.outcomes;
    if (offer === undefined) throw new Error('the design has an offer group');
    const view = plottedOf(
      salaryBarsOf({ ...design, missing: 0, outcomes: [{ ...offer, applications: 5 }, ...rest] }),
    );

    expect(textsOf(view.notes)).toEqual([`$4${SPACE}900 медіана вилки`]);
    expect(textsOf(view.small)).toEqual([
      'відмова через зарплату: 2 відгуки. На такій вибірці медіана лише орієнтир.',
      'інші: 4 відгуки. На такій вибірці медіана лише орієнтир.',
    ]);
  });

  it('tables every outcome, seniority and stack group with its median and range', () => {
    expect(tableOf(salaryBarsOf(buildDesignSalary()))).toEqual([
      ['офер', '1', `$5${SPACE}800`, `$5${SPACE}800–$5${SPACE}800`],
      ['відмова через зарплату', '2', `$3${SPACE}950`, `$3${SPACE}800–$4${SPACE}100`],
      ['інші', '4', `$5${SPACE}050`, `$4${SPACE}500–$6${SPACE}000`],
      ['Middle', '4', `$4${SPACE}300`, `$3${SPACE}800–$4${SPACE}900`],
      ['Senior', '3', `$5${SPACE}800`, `$5${SPACE}200–$6${SPACE}000`],
      ['React', '7', `$4${SPACE}900`, `$3${SPACE}800–$6${SPACE}000`],
      ['TypeScript', '5', `$5${SPACE}200`, `$4${SPACE}500–$6${SPACE}000`],
      ['Node.js', '2', `$5${SPACE}900`, `$5${SPACE}800–$6${SPACE}000`],
    ]);
  });

  it('a search without a single salary shows the empty copy', () => {
    expect(salaryBarsOf(buildNoSalary())).toEqual({
      status: 'empty',
      content: {
        title: 'Вилок ще немає',
        hint: "Тут з'явиться, на якій вилці приходить офер, а на якій відмовляють через зарплату.",
      },
    });
  });
});
