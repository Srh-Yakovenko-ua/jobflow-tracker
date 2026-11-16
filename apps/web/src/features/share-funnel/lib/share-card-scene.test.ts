import { CHART_THEME } from '@jobflow/shared/chart-theme';
import { buildFoldedSankey, contrastRatio } from '@jobflow/shared/testing';
import { describe, expect, it } from 'vitest';

import { DESIGN_HEADLINE as HEADLINE, designFunnelStory } from '@/test/share-story';

import { shareCardSceneOf } from './share-card-scene';

const DESIGN_STORY = designFunnelStory();

const SCHEMES = ['light', 'dark'] as const;

const textsOf = (input: Parameters<typeof shareCardSceneOf>[0]) =>
  shareCardSceneOf(input).texts.map(({ text }) => text);

describe('shareCardSceneOf', () => {
  it('the 54 application search reads as its story, period, funnel headline, KPI row and brand', () => {
    expect(textsOf({ story: DESIGN_STORY, scheme: 'light', hideNumbers: false })).toEqual([
      "54 відгуки, 9 техінтерв'ю, 1 офер",
      'за 12 тижнів',
      'Найширша втеча — на першому кроці',
      '54',
      'відгуки',
      '9',
      "техінтерв'ю",
      '1',
      'офери',
      'JobFlow',
    ]);
  });

  it('labels every funnel node with its Ukrainian name and count', () => {
    const { sankey } = shareCardSceneOf({
      story: DESIGN_STORY,
      scheme: 'light',
      hideNumbers: false,
    });

    expect(sankey.labels).toEqual({
      applied: 'відгук 54',
      screening: 'скринінг 17',
      tech_interview: "техінтерв'ю 9",
      final: 'фінал 4',
      offer: 'офер 1',
      rejected: 'відмова 32',
      ghosted: 'ghosted 17',
      withdrawn: 'відкликав 4',
    });
    expect(sankey.flows).toHaveLength(14);
    expect(sankey.flows[0]).toEqual({ from: 'applied', to: 'screening', flow: 17 });
  });

  it('with numbers hidden keeps the period and headline, drops the KPI row and every count from the node labels', () => {
    const scene = shareCardSceneOf({ story: DESIGN_STORY, scheme: 'dark', hideNumbers: true });

    expect(scene.texts.map(({ text }) => text)).toEqual([
      'Воронка мого пошуку роботи',
      'за 12 тижнів',
      'Найширша втеча — на першому кроці',
      'JobFlow',
    ]);
    expect(Object.values(scene.sankey.labels)).toEqual([
      'відгук',
      'скринінг',
      "техінтерв'ю",
      'фінал',
      'офер',
      'відмова',
      'ghosted',
      'відкликав',
    ]);
  });

  it('a search without a funnel insight draws no headline and says so in the alt text', () => {
    const scene = shareCardSceneOf({
      story: { ...DESIGN_STORY, headline: undefined },
      scheme: 'light',
      hideNumbers: false,
    });

    expect(scene.texts.map(({ text }) => text)).not.toContain(HEADLINE);
    expect(scene.alt).toBe(
      "Картка пошуку роботи. 54 відгуки, 9 техінтерв'ю, 1 офер. За 12 тижнів.",
    );
  });

  it.each([false, true])(
    'no sentence in the alt text starts lowercase, numbers hidden %s',
    (hideNumbers) => {
      const { alt } = shareCardSceneOf({ story: DESIGN_STORY, scheme: 'light', hideNumbers });

      expect(alt.split('. ').filter((sentence) => /^\p{Ll}/u.test(sentence))).toEqual([]);
    },
  );

  it('labels the folded nodes too, so no raw node id reaches the image', () => {
    const graph = buildFoldedSankey().merged;
    const { sankey } = shareCardSceneOf({
      story: { ...DESIGN_STORY, graph },
      scheme: 'light',
      hideNumbers: true,
    });

    expect(Object.keys(sankey.labels)).toEqual(['applied', 'skills_gap', 'other', 'in_progress']);
    expect(sankey.labels.other).toBe('інші');
    expect(sankey.labels.in_progress).toBe('у процесі');
  });

  it.each(SCHEMES)(
    'in %s every text on the card passes 4.5:1 on its background and every node has a colour and a label',
    (scheme) => {
      const scene = shareCardSceneOf({ story: DESIGN_STORY, scheme, hideNumbers: false });
      const colours = [...scene.texts.map(({ colour }) => colour), scene.sankey.labelColour];

      for (const colour of colours) {
        expect(contrastRatio(colour, scene.background)).toBeGreaterThanOrEqual(4.5);
      }
      expect(scene.sankey.labelBackground).toBe(scene.background);
      const nodes = DESIGN_STORY.graph.nodes.map(({ id }) => id);
      expect(Object.keys(scene.sankey.labels)).toEqual(nodes);
      expect(Object.keys(scene.sankey.colours)).toEqual(nodes);
    },
  );

  it('the light and dark cards differ in background and fill the 1200x630 frame', () => {
    const light = shareCardSceneOf({ story: DESIGN_STORY, scheme: 'light', hideNumbers: false });
    const dark = shareCardSceneOf({ story: DESIGN_STORY, scheme: 'dark', hideNumbers: false });

    expect([light.background, dark.background]).toEqual([
      CHART_THEME.light.colors.surface,
      CHART_THEME.dark.colors.surface,
    ]);
    expect(light.size).toEqual({ width: 1200, height: 630 });
  });
});
