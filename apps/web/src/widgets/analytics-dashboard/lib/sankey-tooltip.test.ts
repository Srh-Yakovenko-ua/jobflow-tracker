import type { SankeyLink } from '@jobflow/shared';
import { buildDesignFunnel } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { sankeyTooltipLines } from './sankey-tooltip';

const { stages } = buildDesignFunnel();

function linesOf(link: SankeyLink) {
  return sankeyTooltipLines({ link, stages });
}

describe('sankeyTooltipLines', () => {
  it('shows the flow, how many reached and passed the stage, and the conversion with its Wilson interval', () => {
    expect(linesOf({ from: 'tech_interview', to: 'final', flow: 4, ghost: false })).toEqual([
      "техінтерв'ю → фінал 4",
      'дійшло 9, пройшло 4',
      "конверсія техінтерв'ю → фінал: 50% (22–78%)",
    ]);
    expect(linesOf({ from: 'applied', to: 'screening', flow: 17, ghost: false })).toEqual([
      'відгук → скринінг 17',
      'дійшло 54, пройшло 17',
      'конверсія відгук → скринінг: 43% (29–58%)',
    ]);
  });

  it('a flow into an outcome names the step its conversion belongs to, never reads as the rate of that flow', () => {
    expect(linesOf({ from: 'applied', to: 'rejected', flow: 21, ghost: false })).toEqual([
      'відгук → відмова 21',
      'дійшло 54, пройшло 17',
      'конверсія відгук → скринінг: 43% (29–58%)',
    ]);
  });

  it('a stage short of data says how many are missing and shows no percent', () => {
    expect(linesOf({ from: 'final', to: 'offer', flow: 1, ghost: false })).toEqual([
      'фінал → офер 1',
      'дійшло 4, пройшло 1',
      'Ще 1 відгук до першого висновку',
    ]);
  });

  it('a flow out of offer carries no rate at all', () => {
    expect(linesOf({ from: 'offer', to: 'withdrawn', flow: 1, ghost: false })).toEqual([
      'офер → відкликав 1',
    ]);
  });

  it('a ghost flow says it stays outside the conversions', () => {
    expect(linesOf({ from: 'screening', to: 'ghosted', flow: 2, ghost: true })).toEqual([
      'скринінг → ghosted 2',
      'дійшло 17, пройшло 9',
      "конверсія скринінг → техінтерв'ю: 60% (36–80%)",
      'не входить у розрахунок конверсій',
    ]);
  });

  it('a flow out of a node the funnel does not know, or before the funnel loads, is the flow alone', () => {
    const link: SankeyLink = { from: 'skills_gap', to: 'other', flow: 2, ghost: false };

    expect(linesOf(link)).toEqual(['не вистачає скілів → інші 2']);
    expect(
      sankeyTooltipLines({
        link: { from: 'applied', to: 'screening', flow: 17, ghost: false },
        stages: undefined,
      }),
    ).toEqual(['відгук → скринінг 17']);
  });
});
