import type { Insight, InsightBlock } from '@jobflow/shared';

import { uk } from '@/shared/i18n';

export type TitledBlock = Extract<InsightBlock, 'reasons' | 'sources' | 'resume_ab'>;

export type BlockTitleInput = Readonly<{ insights: readonly Insight[]; block: TitledBlock }>;

export function blockTitleOf({ insights, block }: BlockTitleInput): string {
  const insight = insights.find((candidate) => candidate.block === block);
  return insight?.title ?? uk.analytics.blocks[block].fallback;
}
