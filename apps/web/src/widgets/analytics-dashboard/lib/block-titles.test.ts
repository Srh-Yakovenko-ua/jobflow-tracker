import type { Insight } from '@jobflow/shared';
import { designInsightsBody } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { blockHeaderOf, funnelNotesOf, type TitledBlock } from './block-titles';

const { insights } = designInsightsBody();

const FUNNEL_NOTES = [
  {
    block: 'funnel',
    title: 'Найширша втеча — на першому кроці',
    body: '21 відмова і 14 тиш із 54 — воронка закінчується там, де ти ще ні з ким не говорив.',
  },
  {
    block: 'funnel',
    title: "Техінтерв'ю — найдорожчий етап",
    body: 'Дійшло 9, пройшло 4. Кожна втрата тут — це 2–3 тижні вже витраченого часу.',
  },
];

describe('funnelNotesOf', () => {
  it('reads the funnel insights under the funnel in served order and closes with the ghosted one', () => {
    expect(funnelNotesOf(insights)).toEqual([
      ...FUNNEL_NOTES,
      {
        block: 'ghosted',
        title: '17 компаній не відповіли',
        body: 'Це 31% твоїх відгуків — на 9 п.п. більше за ринок.',
      },
    ]);
  });

  it('without a ghosted insight keeps only the funnel notes', () => {
    const unghosted = insights.filter((insight) => insight.block !== 'ghosted');

    expect(funnelNotesOf(unghosted)).toEqual(FUNNEL_NOTES);
  });

  it('without insights there is nothing to read under the funnel', () => {
    expect(funnelNotesOf([])).toEqual([]);
  });
});

describe('blockHeaderOf', () => {
  it.each<{ block: TitledBlock; title: string; body: string }>([
    {
      block: 'reasons',
      title: "На техінтерв'ю тебе найчастіше валять: «не вистачає скілів»",
      body: '3 із 4 відмов на цьому етапі — «не вистачає скілів».',
    },
    {
      block: 'sources',
      title: "LinkedIn з'їдає час, рефералки — ні",
      body: '16 відгуків через LinkedIn дали 2 скринінги. Djinni при 24 — 9.',
    },
    {
      block: 'resume_ab',
      title: 'Схоже, CV v2 працює краще',
      body: 'Після переходу на CV v2 конверсія виросла з 24% до 41%.',
    },
  ])(
    'the $block block takes its conclusion and the evidence under it from the insights',
    ({ block, title, body }) => {
      expect(blockHeaderOf({ insights, block })).toEqual({ title, body });
    },
  );

  it.each<{ block: TitledBlock; title: string }>([
    { block: 'reasons', title: 'Де відмовляють найчастіше' },
    { block: 'sources', title: 'Яке джерело працює' },
    { block: 'resume_ab', title: 'Яка версія CV працює краще' },
  ])(
    'without an insight the $block block asks a neutral question with no evidence line',
    ({ block, title }) => {
      const others: Insight[] = insights.filter((insight) => insight.block !== block);

      expect(blockHeaderOf({ insights: others, block })).toEqual({ title });
    },
  );
});
