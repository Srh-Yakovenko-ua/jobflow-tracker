'use client';

import { merge } from 'chart.js/helpers';
import type { SankeyParsedData } from 'chartjs-chart-sankey';
import { Bar, Chart } from 'react-chartjs-2';

import { uk } from '@/shared/i18n';
import {
  type ChartThemeOptions,
  sankeyFlowLine,
  sankeyNodeColours,
  useChartTheme,
} from '@/shared/lib/chart';
import { ChartFrame, type ChartFrameState } from '@/shared/ui/chart-frame';

import {
  FUNNEL_FLOWS,
  FUNNEL_NODE_LABELS,
  FUNNEL_SUMMARY,
  reasonLines,
  REJECTION_BARS,
  REJECTION_SUMMARY,
} from './chart-specimens';
import { GallerySection, Note, Specimen } from './gallery';
import { specimenNoop } from './state-specimens';

const COPY = uk.devUi.charts;

const STATES = COPY.states;

const CHART_GRID =
  'grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] items-start gap-4';

const READY: ChartFrameState = { status: 'ready' };

const BAR_LOOK = {
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { padding: 6, font: { size: 10 } } },
    y: { beginAtZero: true, ticks: { padding: 8, stepSize: 5 } },
  },
};

const FUNNEL_LOOK = {
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      callbacks: {
        label: ({ parsed: { _custom: flow } }: { parsed: SankeyParsedData }) =>
          sankeyFlowLine({ from: flow.from.key, to: flow.to.key, flow: flow.flow }),
      },
    },
  },
};

function RejectionsChart() {
  const { palette, options } = useChartTheme();
  const data = {
    labels: REJECTION_BARS.map(({ reason }) => reasonLines(reason)),
    datasets: [
      {
        label: COPY.rejections.series,
        data: REJECTION_BARS.map(({ count }) => count),
        backgroundColor: [...palette.data],
        hoverBackgroundColor: palette.colors.accent,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 34,
      },
    ],
  };
  return (
    <ChartFrame header={COPY.rejections.header} state={READY}>
      <Bar
        role="img"
        aria-label={COPY.rejections.label(REJECTION_SUMMARY)}
        data={data}
        options={merge<object, ChartThemeOptions, typeof BAR_LOOK>({}, [options, BAR_LOOK])}
      />
    </ChartFrame>
  );
}

function FunnelChart() {
  const { palette, options } = useChartTheme();
  const colourOf = sankeyNodeColours(palette);
  const data = {
    datasets: [
      {
        data: [...FUNNEL_FLOWS],
        labels: FUNNEL_NODE_LABELS,
        colorFrom: ({ raw }: { raw: { from: string } }) => colourOf(raw.from),
        colorTo: ({ raw }: { raw: { to: string } }) => colourOf(raw.to),
        color: palette.colors['ink-2'],
        borderWidth: 0,
      },
    ],
  };
  return (
    <ChartFrame header={COPY.funnel.header} state={READY}>
      <Chart
        type="sankey"
        role="img"
        aria-label={COPY.funnel.label(FUNNEL_SUMMARY)}
        data={data}
        options={merge<object, ChartThemeOptions, typeof FUNNEL_LOOK>({}, [options, FUNNEL_LOOK])}
      />
    </ChartFrame>
  );
}

function FrameStates() {
  return (
    <div className={CHART_GRID}>
      <Specimen eyebrow={STATES.loading.eyebrow}>
        <ChartFrame header={STATES.loading.header} state={{ status: 'loading' }} />
      </Specimen>
      <Specimen eyebrow={STATES.insufficient.eyebrow}>
        <ChartFrame
          header={STATES.insufficient.header}
          state={{
            status: 'insufficient_data',
            have: 4,
            need: 10,
            message: STATES.insufficient.message,
          }}
        />
      </Specimen>
      <Specimen eyebrow={STATES.failed.eyebrow}>
        <ChartFrame
          header={STATES.failed.header}
          state={{ status: 'failed', onRetry: specimenNoop }}
        />
      </Specimen>
    </div>
  );
}

export function ChartsSection() {
  return (
    <GallerySection header={COPY}>
      <div className={CHART_GRID}>
        <RejectionsChart />
        <FunnelChart />
      </div>
      <FrameStates />
      <Note>{COPY.note}</Note>
    </GallerySection>
  );
}
