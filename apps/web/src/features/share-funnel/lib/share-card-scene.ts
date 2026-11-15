import { CHART_THEME } from '@jobflow/shared/chart-theme';

import { uk } from '@/shared/i18n';
import {
  type ChartPalette,
  sankeyCountLabel,
  sankeyNodeColours,
  sankeyNodeName,
  sankeyNodeTotal,
} from '@/shared/lib/chart';
import { searchWeeks } from '@/shared/lib/search-weeks';
import type { ShownScheme } from '@/shared/lib/theme';

import type { FunnelStory } from '../model/story';

const COPY = uk.shareCard;

const KPIS = ['sent', 'interviews', 'offers'] as const;

export const SHARE_CARD_SIZE = { width: 1200, height: 630 } as const;

const LAYOUT = {
  left: 64,
  right: 1136,
  story: 104,
  period: 148,
  headline: 188,
  sankey: { x: 64, y: 214, width: 1072, height: 304 },
  kpiValue: 568,
  kpiLabel: 598,
  kpiStep: 200,
} as const;

export type SceneFont = Readonly<{ role: 'display' | 'ui'; size: number; weight: number }>;

export type SceneText = Readonly<{
  text: string;
  font: SceneFont;
  colour: string;
  x: number;
  y: number;
  align: 'left' | 'right';
}>;

export type SceneArea = Readonly<{ x: number; y: number; width: number; height: number }>;

export type SceneFlow = Readonly<{ from: string; to: string; flow: number }>;

export type SceneSankey = Readonly<{
  area: SceneArea;
  flows: readonly SceneFlow[];
  labels: Readonly<Record<string, string>>;
  colours: Readonly<Record<string, string>>;
  labelColour: string;
  labelBackground: string;
}>;

export type ShareCardScene = Readonly<{
  size: typeof SHARE_CARD_SIZE;
  background: string;
  texts: readonly SceneText[];
  sankey: SceneSankey;
  alt: string;
}>;

export type ShareCardSceneInput = Readonly<{
  story: FunnelStory;
  scheme: ShownScheme;
  hideNumbers: boolean;
}>;

type TextSpot = Omit<SceneText, 'text'>;

const FONTS = {
  story: { role: 'display', size: 36, weight: 600 },
  period: { role: 'ui', size: 24, weight: 500 },
  headline: { role: 'ui', size: 22, weight: 600 },
  kpiValue: { role: 'display', size: 34, weight: 600 },
  kpiLabel: { role: 'ui', size: 16, weight: 500 },
  brand: { role: 'ui', size: 18, weight: 700 },
} as const satisfies Record<string, SceneFont>;

function storyLines({ story, hideNumbers }: ShareCardSceneInput): readonly string[] {
  const { sent, interviews, offers, daysInSearch } = story.kpis;
  const counts = { sent: sent.total, interviews: interviews.total, offers: offers.total };
  const lead = hideNumbers ? COPY.storyHidden : COPY.story(counts);
  return [
    lead,
    COPY.period(searchWeeks(daysInSearch)),
    ...(story.headline === undefined ? [] : [story.headline]),
  ];
}

function kpiTexts({ story, hideNumbers }: ShareCardSceneInput, palette: ChartPalette) {
  if (hideNumbers) return [];
  const { colors } = palette;
  return KPIS.flatMap((kpi, index) => {
    const x = LAYOUT.left + index * LAYOUT.kpiStep;
    const at = { x, align: 'left' } as const;
    const label: SceneText = {
      ...at,
      text: COPY.kpi[kpi],
      font: FONTS.kpiLabel,
      colour: colors['ink-3'],
      y: LAYOUT.kpiLabel,
    };
    const value = String(story.kpis[kpi].total);
    const font = FONTS.kpiValue;
    return [{ ...at, text: value, font, colour: colors.ink, y: LAYOUT.kpiValue }, label];
  });
}

function headTexts(lines: readonly string[], palette: ChartPalette): SceneText[] {
  const { colors } = palette;
  const spots: readonly TextSpot[] = [
    { font: FONTS.story, colour: colors.ink, x: LAYOUT.left, y: LAYOUT.story, align: 'left' },
    {
      font: FONTS.period,
      colour: colors['ink-2'],
      x: LAYOUT.left,
      y: LAYOUT.period,
      align: 'left',
    },
    { font: FONTS.headline, colour: colors.ink, x: LAYOUT.left, y: LAYOUT.headline, align: 'left' },
  ];
  return lines.flatMap((text, index) => {
    const spot = spots[index];
    return spot === undefined ? [] : [{ ...spot, text }];
  });
}

function sankeyOf({ story, hideNumbers }: ShareCardSceneInput, palette: ChartPalette): SceneSankey {
  const { graph } = story;
  const totalOf = sankeyNodeTotal(graph);
  const colourOf = sankeyNodeColours(palette);
  const ids = graph.nodes.map(({ id }) => id);
  const labelOf = (id: string) =>
    hideNumbers ? sankeyNodeName(id) : sankeyCountLabel({ id, count: totalOf(id) });
  return {
    area: LAYOUT.sankey,
    flows: graph.links.map(({ from, to, flow }) => ({ from, to, flow })),
    labels: Object.fromEntries(ids.map((id) => [id, labelOf(id)])),
    colours: Object.fromEntries(ids.map((id) => [id, colourOf(id)])),
    labelColour: palette.colors.ink,
    labelBackground: palette.colors.surface,
  };
}

export function shareCardSceneOf(input: ShareCardSceneInput): ShareCardScene {
  const palette = CHART_THEME[input.scheme];
  const lines = storyLines(input);
  const brand: SceneText = {
    text: uk.app.brand,
    font: FONTS.brand,
    colour: palette.colors['ink-3'],
    x: LAYOUT.right,
    y: LAYOUT.kpiLabel,
    align: 'right',
  };
  return {
    size: SHARE_CARD_SIZE,
    background: palette.colors.surface,
    texts: [...headTexts(lines, palette), ...kpiTexts(input, palette), brand],
    sankey: sankeyOf(input, palette),
    alt: COPY.alt(lines),
  };
}
