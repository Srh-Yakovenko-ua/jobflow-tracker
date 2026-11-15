import type { ResumeAbResponse } from '@jobflow/shared';
import {
  buildDesignResumeAb,
  buildDesignResumeAbComparison,
  INSUFFICIENT_RATES,
} from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { lowDataResumeAb } from '@/test/analytics-fixtures';
import { barsOf, plottedOf, tableOf, textsOf } from '@/test/evidence-view';

import { resumeAbHeaderOf, resumeAbLowOf, resumeAbViewOf } from './resume-ab-view';

const KYIV = 'Europe/Kyiv';

const SHORT = INSUFFICIENT_RATES.twoMore;

const viewOf = (data: ResumeAbResponse) => resumeAbViewOf({ data, timeZone: KYIV });

describe('resumeAbViewOf', () => {
  it('plots the versions with five samples or more as CV bars at the served conversion with interval whiskers on a 60% axis', () => {
    const view = viewOf(buildDesignResumeAb());

    expect(barsOf(view)).toEqual([
      ['CV v2 · акцент на продукті', 41, [25, 59]],
      ['CV v1 · хронологічне', 24, [11, 45]],
    ]);
    expect(plottedOf(view).chart.rows.map(({ colour }) => colour)).toEqual([1, 4]);
    expect(plottedOf(view).chart.scale.max).toBe(60);
  });

  it('the tooltip of a bar reads its percent with the raw counts and its interval', () => {
    const [challenger] = plottedOf(viewOf(buildDesignResumeAb())).chart.rows;

    expect(challenger?.tip).toEqual(['41% · 11 із 27', 'інтервал: 25–59%']);
  });

  it('under the bars reads the probability that the challenger is better and the conversion around the switch date', () => {
    expect(textsOf(plottedOf(viewOf(buildDesignResumeAb())).notes)).toEqual([
      'Імовірність, що CV v2 краще за v1: 88%',
      'Після переходу на CV v2 02.12: конверсія 24% → 41%',
    ]);
  });

  it('a switch side under the sample floor shows мало даних instead of a percent', () => {
    const comparison = buildDesignResumeAbComparison();
    const data = {
      ...buildDesignResumeAb(),
      comparison: { ...comparison, switch: { ...comparison.switch, before: SHORT } },
    };

    expect(textsOf(plottedOf(viewOf(data)).notes)[1]).toBe(
      'Після переходу на CV v2 02.12: конверсія мало даних · Ще 2 відгуки до першого висновку → 41%',
    );
  });

  it('sends CV v3 with three applications to the n<5 note with raw counts and lists every version in the table', () => {
    const view = viewOf(buildDesignResumeAb());

    expect(textsOf(plottedOf(view).small)).toEqual([
      'CV v3: 3 відгуки, 1 скринінг. Відсоток на такій вибірці лише шум.',
    ]);
    expect(tableOf(view)).toEqual([
      ['CV v3 · для дизайн-ролей', '3', '1', 'мало даних · Ще 2 відгуки до першого висновку'],
      ['CV v2 · акцент на продукті', '27', '11', '41%'],
      ['CV v1 · хронологічне', '21', '5', '24%'],
    ]);
  });

  it('with every version under the floor plots nothing and lists them all in the n<5 note', () => {
    const design = buildDesignResumeAb();
    const view = viewOf({
      ...design,
      versions: design.versions.map((version) => ({ ...version, conversion: SHORT })),
    });

    expect(barsOf(view)).toEqual([]);
    expect(plottedOf(view).small).toHaveLength(3);
  });

  it('no versions and a single version show their own empty copy', () => {
    const [only] = buildDesignResumeAb().versions;

    expect(viewOf({ versions: [], comparison: null })).toEqual({
      status: 'empty',
      content: {
        title: 'Версій резюме ще немає',
        hint: "Познач, з яким CV ти відгукуєшся, і тут з'явиться порівняння версій.",
      },
    });
    expect(viewOf({ versions: only === undefined ? [] : [only], comparison: null })).toEqual({
      status: 'empty',
      content: {
        title: 'Поки що лише одна версія CV',
        hint: "Порівняння з'явиться, коли ти відгукнешся з другою версією.",
      },
    });
  });
});

describe('resumeAbLowOf and resumeAbHeaderOf', () => {
  it('an insufficient verdict turns the frame into its low data state and keeps the neutral title', () => {
    const data = lowDataResumeAb();

    expect(resumeAbLowOf(data)).toEqual({
      status: 'insufficient_data',
      have: 4,
      need: 6,
      message: 'Ще 6 відгуків до першого висновку',
    });
    expect(resumeAbHeaderOf(data)).toEqual({
      eyebrow: 'A/B версій резюме',
      title: 'Яка версія CV працює краще',
    });
  });

  it('an ok verdict keeps the frame ready and becomes the title as served', () => {
    const data = buildDesignResumeAb();

    expect(resumeAbLowOf(data)).toBeUndefined();
    expect(resumeAbLowOf({ versions: [], comparison: null })).toBeUndefined();
    expect(resumeAbHeaderOf(data).title).toBe('Схоже, CV v2 працює краще');
    expect(resumeAbHeaderOf(undefined).title).toBe('Яка версія CV працює краще');
  });
});
