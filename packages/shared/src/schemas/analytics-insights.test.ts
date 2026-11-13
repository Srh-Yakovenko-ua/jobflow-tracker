import { describe, expect, it } from 'vitest';

import { designInsightsBody } from '../../testing/index.js';
import { issuePathsOf } from '../test/zod-issues.js';
import { insightsResponseSchema } from './analytics-insights.js';

const DESIGN_INSIGHTS = designInsightsBody();

describe('insightsResponseSchema', () => {
  it('accepts the six design headlines and four actions from the analytics snapshot', () => {
    expect(insightsResponseSchema.parse(DESIGN_INSIGHTS)).toEqual(DESIGN_INSIGHTS);
    expect(DESIGN_INSIGHTS.actions.map(({ expectedEffect }) => expectedEffect)).toEqual([
      'Прогноз офера звузиться до діапазону від 3 до 11 тижнів, якщо конверсія дійде до 60%.',
      'Ті самі 16 відгуків через Djinni дали б 6 скринінгів замість 2.',
      '3 скринінги на 3 відгуки через рефералки. Вибірка мала, але напрям однозначний.',
      'Конверсія у скринінг 41% проти 24% до переходу на CV v2.',
    ]);
  });

  it('accepts empty lists below the insight threshold', () => {
    expect(insightsResponseSchema.parse({ insights: [], actions: [] })).toEqual({
      insights: [],
      actions: [],
    });
  });

  it.for([
    { label: 'an unknown block', change: { block: 'kpis' }, path: 'insights.0.block' },
    { label: 'an empty title', change: { title: '' }, path: 'insights.0.title' },
    { label: 'an unknown severity', change: { severity: 'danger' }, path: 'insights.0.severity' },
    {
      label: 'evidence that is not a string or a number',
      change: { evidence: { ghosted: true } },
      path: 'insights.0.evidence.ghosted',
    },
  ])('refuses $label at $path', ({ change, path }) => {
    const [first, ...rest] = DESIGN_INSIGHTS.insights;
    const body = { ...DESIGN_INSIGHTS, insights: [{ ...first, ...change }, ...rest] };
    expect(issuePathsOf(insightsResponseSchema.safeParse(body))).toEqual([path]);
  });

  it.for([
    { label: 'an action with an empty title', change: { title: '' }, path: 'actions.0.title' },
    {
      label: 'an action with an empty expected effect',
      change: { expectedEffect: '' },
      path: 'actions.0.expectedEffect',
    },
    { label: 'an action on an unknown block', change: { block: 'kpis' }, path: 'actions.0.block' },
  ])('refuses $label at $path', ({ change, path }) => {
    const [first, ...rest] = DESIGN_INSIGHTS.actions;
    const body = { ...DESIGN_INSIGHTS, actions: [{ ...first, ...change }, ...rest] };
    expect(issuePathsOf(insightsResponseSchema.safeParse(body))).toEqual([path]);
  });
});
