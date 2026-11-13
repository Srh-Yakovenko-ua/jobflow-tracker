import type { Insight } from '@jobflow/shared';
import { designInsightsBody } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { blockTitleOf, type TitledBlock } from './block-titles';

const { insights } = designInsightsBody();

describe('blockTitleOf', () => {
  it.each<{ block: TitledBlock; title: string }>([
    { block: 'reasons', title: "На техінтерв'ю тебе найчастіше валять: «не вистачає скілів»" },
    { block: 'sources', title: "LinkedIn з'їдає час, рефералки — ні" },
    { block: 'resume_ab', title: 'Схоже, CV v2 працює краще' },
  ])('the $block block takes its conclusion from the insights', ({ block, title }) => {
    expect(blockTitleOf({ insights, block })).toBe(title);
  });

  it.each<{ block: TitledBlock; title: string }>([
    { block: 'reasons', title: 'Де відмовляють найчастіше' },
    { block: 'sources', title: 'Яке джерело працює' },
    { block: 'resume_ab', title: 'Яка версія CV працює краще' },
  ])('without an insight the $block block asks a neutral question', ({ block, title }) => {
    const others: Insight[] = insights.filter((insight) => insight.block !== block);

    expect(blockTitleOf({ insights: others, block })).toBe(title);
  });
});
