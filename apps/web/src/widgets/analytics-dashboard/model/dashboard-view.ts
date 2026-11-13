import { type FunnelStage, type SankeyResponse, THRESHOLDS } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import type { ChartFrameHeader, ChartFrameState } from '@/shared/ui/chart-frame';
import { chartFrameStateOf, type FrameQuery } from '@/shared/ui/chart-frame-state';

import { blockTitleOf, type TitledBlock } from '../lib/block-titles';
import type { DashboardQueries } from './use-dashboard-queries';

const BLOCKS = uk.analytics.blocks;

export type DashboardFrame = Readonly<{ header: ChartFrameHeader; state: ChartFrameState }>;

export type DashboardFrameId =
  'sankey' | 'reasons' | 'sources' | 'resumeAb' | 'forecast' | 'timings';

export type SankeyFrame = DashboardFrame &
  Readonly<{ graph: SankeyResponse | undefined; stages: readonly FunnelStage[] | undefined }>;

export type DashboardFrames = Record<DashboardFrameId, DashboardFrame> & { sankey: SankeyFrame };

export type DashboardViewInput = Readonly<{ queries: DashboardQueries; searches: FrameQuery }>;

type SearchBoundQuery = Readonly<{ query: FrameQuery; searches: FrameQuery }>;

function searchBoundState({ query, searches }: SearchBoundQuery): ChartFrameState {
  return chartFrameStateOf(searches.data === undefined ? searches : query);
}

function sankeyHeader(sent: number | undefined): ChartFrameHeader {
  const { eyebrow, title } = BLOCKS.sankey;
  return sent === undefined ? { eyebrow } : { eyebrow, title: title(sent) };
}

function framesOf({ queries, searches }: DashboardViewInput): DashboardFrames {
  const insights = queries.insights.data?.insights ?? [];
  const titled = (block: TitledBlock): ChartFrameHeader => ({
    eyebrow: BLOCKS[block].eyebrow,
    title: blockTitleOf({ insights, block }),
  });
  return {
    sankey: {
      header: sankeyHeader(queries.funnel.data?.kpis.sent.total),
      state: searchBoundState({ query: queries.sankey, searches }),
      graph: queries.sankey.data,
      stages: queries.funnel.data?.stages,
    },
    reasons: { header: titled('reasons'), state: chartFrameStateOf(queries.reasons) },
    sources: { header: titled('sources'), state: chartFrameStateOf(queries.sources) },
    resumeAb: { header: titled('resume_ab'), state: chartFrameStateOf(queries.resumeAb) },
    forecast: { header: BLOCKS.forecast, state: chartFrameStateOf(queries.forecast) },
    timings: { header: BLOCKS.timings, state: chartFrameStateOf(queries.timings) },
  };
}

export function dashboardViewOf(input: DashboardViewInput) {
  const { funnel, timings } = input.queries;
  const kpis = funnel.data?.kpis;
  return {
    kpis,
    lowData: kpis !== undefined && kpis.sent.total < THRESHOLDS.MIN_N_INSIGHT,
    frames: framesOf(input),
    kpi: {
      funnel: {
        state: searchBoundState({ query: funnel, searches: input.searches }),
        data: funnel.data,
      },
      timings: { state: chartFrameStateOf(timings), data: timings.data },
    },
  };
}

export type DashboardView = ReturnType<typeof dashboardViewOf>;

export type DashboardKpi = DashboardView['kpi'];
