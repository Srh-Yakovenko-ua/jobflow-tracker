'use client';

import { type ForecastResponse, THRESHOLDS } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { ChartFrame, type ChartFrameState } from '@/shared/ui/chart-frame';
import { DashedBars, EmptyState } from '@/shared/ui/empty-state';

import { forecastViewOf, type OkForecast } from '../lib/forecast-view';
import type { ForecastFrame } from '../model/dashboard-view';
import { FORECAST_STRIPES, ForecastBand } from './forecast-band';
import { type ForecastControls, ForecastControlsPanel } from './forecast-controls';
import { ForecastMethod } from './forecast-method';
import { Swatch } from './swatch';

export type { ForecastControls } from './forecast-controls';

const COPY = uk.analytics;

const FORECAST = COPY.blocks.forecast;

const READY: ChartFrameState = { status: 'ready' };

const TEXT = 'text-[12.5px] leading-[1.6] text-pretty text-ink-2 tabular-nums';

type Insufficient = Extract<ForecastResponse, { status: 'insufficient_data' }>;

const belowThreshold = (forecast: ForecastResponse | undefined): forecast is Insufficient =>
  forecast?.status === 'insufficient_data' &&
  forecast.have + forecast.need === THRESHOLDS.MIN_N_FORECAST;

export type ForecastBlockProps = Readonly<{ frame: ForecastFrame; controls: ForecastControls }>;

function ForecastEmpty({ forecast }: Readonly<{ forecast: Insufficient }>) {
  return (
    <EmptyState
      content={{ title: FORECAST.empty.title(forecast.need), hint: COPY.lowDataState.forecast.why }}
      progress={{
        count: forecast.have,
        goal: THRESHOLDS.MIN_N_FORECAST,
        label: FORECAST.empty.meter,
      }}
      slots={{ figure: <DashedBars view={{ density: 'compact' }} /> }}
      view={{ size: 'compact' }}
    />
  );
}

function Legend({ lines }: Readonly<{ lines: readonly string[] }>) {
  const marks = [
    <Swatch key="likely" fill="bg-accent" />,
    <Swatch key="interval" fill={FORECAST_STRIPES} />,
    <span key="median" aria-hidden className="mx-1.25 h-3 w-0.5 flex-none rounded-[1px] bg-ink" />,
  ];
  return (
    <ul className="flex flex-col gap-1.5 text-[12.5px] text-ink-2 tabular-nums">
      {lines.map((line, position) => (
        <li key={line} className="flex items-center gap-2.25">
          {marks[position]}
          {line}
        </li>
      ))}
    </ul>
  );
}

type ForecastPlotProps = Readonly<{ forecast: OkForecast; controls: ForecastControls }>;

function ForecastPlot({ forecast, controls }: ForecastPlotProps) {
  const view = forecastViewOf({ forecast, improved: controls.value.improve !== undefined });
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="font-display text-[34px] leading-none font-semibold tracking-[-0.045em] text-ink tabular-nums">
          {view.headline}
        </p>
        <p className="text-[13px] leading-[1.55] text-pretty text-ink-2 tabular-nums">
          {view.caption}
        </p>
      </div>
      <ForecastBand band={view.band} />
      <Legend lines={view.legend} />
      <p className="text-[13px] font-semibold text-ink tabular-nums">{view.odds}</p>
      <ForecastControlsPanel controls={controls} observedRate={forecast.applicationsPerWeek} />
      <p className={TEXT}>{view.note}</p>
    </div>
  );
}

export function ForecastBlock({ frame, controls }: ForecastBlockProps) {
  const { data } = frame;
  const ownEmpty = belowThreshold(data);
  return (
    <ChartFrame
      header={frame.header}
      state={ownEmpty ? READY : frame.state}
      view={{ plot: 'open', actions: <ForecastMethod /> }}
    >
      {ownEmpty && <ForecastEmpty forecast={data} />}
      {data?.status === 'ok' && <ForecastPlot forecast={data} controls={controls} />}
    </ChartFrame>
  );
}
