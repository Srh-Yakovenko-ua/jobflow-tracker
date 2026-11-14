import type { MatchValidationResponse } from '@jobflow/shared';
import { buildDesignMatchValidation, INSUFFICIENT_RATES } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { lowDataMatchValidation } from '@/test/analytics-fixtures';
import { barsOf, plottedOf, tableOf, textsOf } from '@/test/evidence-view';

import { matchBarsOf, matchHeaderOf, matchLowOf } from './match-bars';

const SHORT = INSUFFICIENT_RATES.twoMore;

function withFirstBucketShort(): MatchValidationResponse {
  const design = buildDesignMatchValidation();
  const [first, ...rest] = design.buckets;
  if (first === undefined) throw new Error('the design has buckets');
  return { ...design, buckets: [{ ...first, applications: 3, interview: SHORT }, ...rest] };
}

describe('matchBarsOf', () => {
  it('plots the interview rate of each Match Score bucket with its interval on an 80% axis', () => {
    const view = matchBarsOf(buildDesignMatchValidation());

    expect(barsOf(view)).toEqual([
      ['до 50 / 51 відгук', 14, [7, 26]],
      ['50–74 / 54 відгуки', 41, [29, 54]],
      ['75+ / 45 відгуків', 51, [37, 65]],
    ]);
    expect(plottedOf(view).chart.scale.max).toBe(80);
    expect(plottedOf(view).chart.rows[0]?.tip).toEqual([
      "конверсія до інтерв'ю: 14% (7–26%)",
      '7 із 51',
    ]);
  });

  it('under the bars reads the correlation and the applications left without a Match Score', () => {
    expect(textsOf(plottedOf(matchBarsOf(buildDesignMatchValidation())).notes)).toEqual([
      'r = 0,35 на 150 відгуках',
      '6 відгуків без Match Score не входять у розрахунок.',
    ]);
  });

  it('the table lists every bucket with its screening and interview rate', () => {
    expect(tableOf(matchBarsOf(buildDesignMatchValidation()))).toEqual([
      ['до 50', '51', '41%', '14%'],
      ['50–74', '54', '57%', '41%'],
      ['75+', '45', '87%', '51%'],
    ]);
  });

  it('a bucket under the floor leaves the chart for the n<5 note and insufficient statistics read their message instead of the correlation', () => {
    const data = { ...withFirstBucketShort(), unscored: 0, statistics: SHORT };
    const view = matchBarsOf(data);

    expect(barsOf(view).map(([label]) => label)).toEqual([
      '50–74 / 54 відгуки',
      '75+ / 45 відгуків',
    ]);
    expect(textsOf(plottedOf(view).small)).toEqual([
      'до 50: 3 відгуки. Відсоток на такій вибірці лише шум.',
    ]);
    expect(textsOf(plottedOf(view).notes)).toEqual(['Ще 2 відгуки до першого висновку']);
  });

  it('no scored application shows the empty copy', () => {
    expect(matchBarsOf({ ...buildDesignMatchValidation(), scored: 0 })).toEqual({
      status: 'empty',
      content: {
        title: 'Match Score ще немає',
        hint: "Тут з'явиться, чи частіше вакансії з високим збігом доходять до інтерв'ю.",
      },
    });
  });
});

describe('matchLowOf and matchHeaderOf', () => {
  it('no measured bucket turns the frame into the statistics low data state with the neutral title', () => {
    const data = lowDataMatchValidation();

    expect(matchLowOf(data)).toEqual({
      status: 'insufficient_data',
      have: 4,
      need: 6,
      message: 'Ще 6 відгуків до першого висновку',
    });
    expect(matchHeaderOf(data)).toEqual({
      eyebrow: 'Match Score · перевірка на відгуках',
      title: "Чи передбачає Match Score інтерв'ю",
    });
  });

  it('with ok statistics but no measured bucket the largest bucket gives the low data state', () => {
    const data = {
      ...lowDataMatchValidation(),
      statistics: buildDesignMatchValidation().statistics,
    };

    expect(matchLowOf(data)).toEqual(SHORT);
  });

  it('one measured bucket or no scored application keep the frame ready, ok statistics become the title', () => {
    expect(matchLowOf(withFirstBucketShort())).toBeUndefined();
    expect(matchLowOf({ ...buildDesignMatchValidation(), scored: 0 })).toBeUndefined();
    expect(matchHeaderOf(buildDesignMatchValidation()).title).toBe(
      "Вакансії зі збігом 75+ доходять до інтерв'ю у 3,7 раза частіше, ніж до 50",
    );
  });
});
