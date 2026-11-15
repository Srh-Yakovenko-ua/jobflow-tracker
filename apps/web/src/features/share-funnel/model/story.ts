import type { FunnelKpis, SankeyGraph } from '@jobflow/shared';

export type FunnelStory = Readonly<{
  kpis: FunnelKpis;
  graph: SankeyGraph;
  headline: string | undefined;
}>;
