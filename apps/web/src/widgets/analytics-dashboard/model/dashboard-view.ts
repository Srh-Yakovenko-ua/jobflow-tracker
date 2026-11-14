import {
  type ForecastResponse,
  type FunnelStage,
  type InsightAction,
  type MatchValidationResponse,
  type ReasonsResponse,
  type ResumeAbResponse,
  type SankeyResponse,
  type SourcesResponse,
  THRESHOLDS,
  type TimingsResponse,
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
import type { InsufficientState } from '../lib/interval-bars';
import { matchHeaderOf, matchLowOf } from '../lib/match-bars';
import { resumeAbHeaderOf, resumeAbLowOf } from '../lib/resume-ab-view';
import { timingsLowOf } from '../lib/timing-bars';
import type { DashboardQueries } from './use-dashboard-queries';

const BLOCKS = uk.analytics.blocks;

export type DashboardFrame = Readonly<{ header: ChartFrameHeader; state: ChartFrameState }>;

export type DashboardFrameId =
  'sankey' | 'reasons' | 'sources' | 'resumeAb' | 'forecast' | 'timings' | 'matchValidation';

export type SankeyFrame = DashboardFrame &
  Readonly<{
    graph: SankeyResponse | undefined;
    stages: readonly FunnelStage[] | undefined;
    notes: readonly FunnelNote[];
  }>;

export type ActionsView = Readonly<{
  state: ChartFrameState;
  actions: readonly InsightAction[] | undefined;
  hidden: boolean;
}>;

export type ReasonsFrame = DashboardFrame & Readonly<{ data: ReasonsResponse | undefined }>;

export type SourcesFrame = DashboardFrame & Readonly<{ data: SourcesResponse | undefined }>;

export type ForecastFrame = DashboardFrame & Readonly<{ data: ForecastResponse | undefined }>;

export type ResumeAbFrame = DashboardFrame & Readonly<{ data: ResumeAbResponse | undefined }>;

export type TimingsFrame = DashboardFrame & Readonly<{ data: TimingsResponse | undefined }>;

export type MatchValidationFrame = DashboardFrame &
  Readonly<{ data: MatchValidationResponse | undefined }>;

export type DashboardFrames = Record<DashboardFrameId, DashboardFrame> & {
  sankey: SankeyFrame;
  reasons: ReasonsFrame;
  sources: SourcesFrame;
  resumeAb: ResumeAbFrame;
  forecast: ForecastFrame;
  timings: TimingsFrame;
  matchValidation: MatchValidationFrame;
};

export type DashboardViewInput = Readonly<{ queries: DashboardQueries; searches: FrameQuery }>;

type SearchBoundQuery = Readonly<{ query: FrameQuery; searches: FrameQuery }>;

type LowDataQuery<Data> = Readonly<{
  query: FrameQuery & Readonly<{ data: Data | undefined }>;
  low: (data: Data) => InsufficientState | undefined;
}>;

type EvidenceFrames = Pick<DashboardFrames, 'resumeAb' | 'timings' | 'matchValidation'>;

function lowDataStateOf<Data>({ query, low }: LowDataQuery<Data>): ChartFrameState {
  const state = chartFrameStateOf(query);
  if (state.status !== 'ready' || query.data === undefined) return state;
  return low(query.data) ?? state;
}

function evidenceFramesOf({
  resumeAb,
  timings,
  matchValidation,
}: DashboardQueries): EvidenceFrames {
  return {
    resumeAb: {
      header: resumeAbHeaderOf(resumeAb.data),
      state: lowDataStateOf({ query: resumeAb, low: resumeAbLowOf }),
      data: resumeAb.data,
    },
    timings: {
      header: { eyebrow: BLOCKS.timings.eyebrow },
      state: lowDataStateOf({ query: timings, low: timingsLowOf }),
      data: timings.data,
    },
    matchValidation: {
      header: matchHeaderOf(matchValidation.data),
      state: lowDataStateOf({ query: matchValidation, low: matchLowOf }),
      data: matchValidation.data,
    },
  };
}

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
    forecast: {
      header: { eyebrow: BLOCKS.forecast.eyebrow },
      state: chartFrameStateOf(queries.forecast),
      data: queries.forecast.data,
    },
    ...evidenceFramesOf(queries),
  };
}

export function dashboardViewOf(input: DashboardViewInput) {
  const { funnel, timings, insights, summary } = input.queries;
  const kpis = funnel.data?.kpis;
  const actions: ActionsView = {
    state: chartFrameStateOf(insights),
    actions: insights.data?.actions,
    hidden: Boolean(summary.data?.summary),
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
