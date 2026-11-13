import {
  type ForecastResponse,
  type FunnelStage,
  type InsightAction,
  type ReasonsResponse,
  type SankeyResponse,
  type SourcesResponse,
  THRESHOLDS,
} from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import type { ChartFrameHeader, ChartFrameState } from '@/shared/ui/chart-frame';
import { chartFrameStateOf, type FrameQuery } from '@/shared/ui/chart-frame-state';

import {
  blockHeaderOf,
  type FunnelNote,
  funnelNotesOf,
  type TitledBlock,
} from '../lib/block-titles';
import type { DashboardQueries } from './use-dashboard-queries';

const BLOCKS = uk.analytics.blocks;

export type DashboardFrame = Readonly<{ header: ChartFrameHeader; state: ChartFrameState }>;

export type DashboardFrameId =
  'sankey' | 'reasons' | 'sources' | 'resumeAb' | 'forecast' | 'timings';

export type SankeyFrame = DashboardFrame &
  Readonly<{
    graph: SankeyResponse | undefined;
    stages: readonly FunnelStage[] | undefined;
    notes: readonly FunnelNote[];
  }>;

export type ActionsView = Readonly<{
  state: ChartFrameState;
  actions: readonly InsightAction[] | undefined;
}>;

export type ReasonsFrame = DashboardFrame & Readonly<{ data: ReasonsResponse | undefined }>;

export type SourcesFrame = DashboardFrame & Readonly<{ data: SourcesResponse | undefined }>;

export type ForecastFrame = DashboardFrame & Readonly<{ data: ForecastResponse | undefined }>;

export type DashboardFrames = Record<DashboardFrameId, DashboardFrame> & {
  sankey: SankeyFrame;
  reasons: ReasonsFrame;
  sources: SourcesFrame;
  forecast: ForecastFrame;
};

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
    ...blockHeaderOf({ insights, block }),
  });
  return {
    sankey: {
      header: sankeyHeader(queries.funnel.data?.kpis.sent.total),
      state: searchBoundState({ query: queries.sankey, searches }),
      graph: queries.sankey.data,
      stages: queries.funnel.data?.stages,
      notes: funnelNotesOf(insights),
    },
    reasons: {
      header: titled('reasons'),
      state: chartFrameStateOf(queries.reasons),
      data: queries.reasons.data,
    },
    sources: {
      header: titled('sources'),
      state: chartFrameStateOf(queries.sources),
      data: queries.sources.data,
    },
    resumeAb: { header: titled('resume_ab'), state: chartFrameStateOf(queries.resumeAb) },
    forecast: {
      header: { eyebrow: BLOCKS.forecast.eyebrow },
      state: chartFrameStateOf(queries.forecast),
      data: queries.forecast.data,
    },
    timings: { header: BLOCKS.timings, state: chartFrameStateOf(queries.timings) },
  };
}

export function dashboardViewOf(input: DashboardViewInput) {
  const { funnel, timings, insights } = input.queries;
  const kpis = funnel.data?.kpis;
  const actions: ActionsView = {
    state: chartFrameStateOf(insights),
    actions: insights.data?.actions,
  };
  return {
    kpis,
    lowData: kpis !== undefined && kpis.sent.total < THRESHOLDS.MIN_N_INSIGHT,
    frames: framesOf(input),
    actions,
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
