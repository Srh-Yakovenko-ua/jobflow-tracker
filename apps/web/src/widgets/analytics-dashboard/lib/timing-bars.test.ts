import { buildDesignTimings } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { lowDataTimings } from '@/test/analytics-fixtures';
import { barsOf, plottedOf, tableOf, textsOf } from '@/test/evidence-view';

import { timingBarsOf, timingsLowOf } from './timing-bars';

describe('timingBarsOf', () => {
  it('plots each stage with five samples or more at its median with the quartiles as the whisker, in stage colours', () => {
    const view = timingBarsOf(buildDesignTimings());
    const { rows, scale } = plottedOf(view).chart;

    expect(barsOf(view)).toEqual([
      ['відгук', 2, [2, 6]],
      ['скринінг', 11, [2, 11]],
      ["техінтерв'ю", 5.5, [2, 9]],
    ]);
    expect(rows.map(({ colour }) => colour)).toEqual([0, 1, 2]);
    expect(rows.map(({ href }) => href)).toEqual([
      '/board?stage=applied',
      '/board?stage=screening',
      '/board?stage=tech_interview',
    ]);
    expect(scale.step).toBe(5);
  });

  it('the tooltip reads the median in days and the typical range between the quartiles', () => {
    const { rows } = plottedOf(timingBarsOf(buildDesignTimings())).chart;

    expect(rows.map(({ tip }) => tip)).toEqual([
      ['2 дні · медіана', 'типово 2–6 днів'],
      ['11 днів · медіана', 'типово 2–11 днів'],
      ['5,5 дня · медіана', 'типово 2–9 днів'],
    ]);
  });

  it('sends the final stage with four samples to the n<5 note and shows no median for it in the table', () => {
    const view = timingBarsOf(buildDesignTimings());

    expect(textsOf(plottedOf(view).small)).toEqual([
      'фінал: 4 заміри. Ще 1 відгук до першого висновку',
    ]);
    expect(tableOf(view)).toEqual([
      ['відгук', '2', '2–6', '40'],
      ['скринінг', '11', '2–11', '15'],
      ["техінтерв'ю", '5,5', '2–9', '8'],
      ['фінал', 'мало даних · Ще 1 відгук до першого висновку', '—', '4'],
    ]);
  });

  it('a search without stage timings shows the empty copy', () => {
    expect(timingBarsOf({ ...buildDesignTimings(), stages: [] })).toEqual({
      status: 'empty',
      content: {
        title: 'Етапів ще немає',
        hint: "Тут з'явиться, скільки днів відгук проводить на кожному етапі.",
      },
    });
  });
});

describe('timingsLowOf', () => {
  it('every stage under the floor turns the frame into the first stage low data state', () => {
    expect(timingsLowOf(lowDataTimings())).toEqual({
      status: 'insufficient_data',
      have: 3,
      need: 2,
      message: 'Ще 2 відгуки до першого висновку',
    });
  });

  it('one measured stage or no stages at all keep the frame ready', () => {
    expect(timingsLowOf(buildDesignTimings())).toBeUndefined();
    expect(timingsLowOf({ ...buildDesignTimings(), stages: [] })).toBeUndefined();
  });
});
