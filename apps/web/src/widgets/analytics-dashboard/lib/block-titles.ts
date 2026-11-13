import type { Insight, InsightBlock } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

export type TitledBlock = Extract<InsightBlock, 'reasons' | 'sources' | 'resume_ab'>;

export type BlockTitleInput = Readonly<{ insights: readonly Insight[]; block: TitledBlock }>;

export type BlockHeader = Readonly<{ title: string; body?: string }>;

export type FunnelNote = Pick<Insight, 'block' | 'title' | 'body'>;

const NOTE_BLOCKS: readonly InsightBlock[] = ['funnel', 'ghosted'];

export function funnelNotesOf(insights: readonly Insight[]): FunnelNote[] {
  return NOTE_BLOCKS.flatMap((block) =>
    insights
      .filter((insight) => insight.block === block)
      .map(({ title, body }) => ({ block, title, body })),
  );
}

export function blockHeaderOf({ insights, block }: BlockTitleInput): BlockHeader {
  const insight = insights.find((candidate) => candidate.block === block);
  return insight === undefined
    ? { title: uk.analytics.blocks[block].fallback }
    : { title: insight.title, body: insight.body };
}
