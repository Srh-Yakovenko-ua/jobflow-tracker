import { buildDesignFunnel, buildDesignSankey, designInsightsBody } from '@jobflow/shared/testing';

import type { FunnelStory } from '@/features/share-funnel';

export const DESIGN_HEADLINE = designInsightsBody().insights.find(
  ({ block }) => block === 'funnel',
)?.title;

export function designFunnelStory(): FunnelStory {
  return {
    kpis: buildDesignFunnel().kpis,
    graph: buildDesignSankey().merged,
    headline: DESIGN_HEADLINE,
  };
}
