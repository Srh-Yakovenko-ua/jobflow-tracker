'use client';

import { CHART_THEME } from '@jobflow/shared/chart-theme';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Flow, SankeyController } from 'chartjs-chart-sankey';

export type EntryContext = Readonly<{
  type: string;
  mode: string;
  dataIndex: number;
  datasetIndex: number;
}>;

const { animation, motion } = CHART_THEME;

const ANSWER = { duration: motion.fast, easing: animation.easing };

export function seriesEntryDelay({ type, mode, dataIndex, datasetIndex }: EntryContext): number {
  if (type !== 'data' || mode !== 'default') return 0;
  return (dataIndex + 2 * datasetIndex) * animation.stagger;
}

Chart.register(
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  Tooltip,
  Legend,
  SankeyController,
  Flow,
);

Chart.defaults.font.size = 11;
Chart.defaults.set('animation', {
  duration: animation.duration,
  easing: animation.easing,
  delay: seriesEntryDelay,
});
Chart.defaults.set('transitions.active.animation', ANSWER);
Chart.defaults.set('plugins.tooltip', {
  cornerRadius: 10,
  padding: 10,
  displayColors: true,
  boxWidth: 9,
  boxHeight: 9,
  usePointStyle: false,
  animation: ANSWER,
});
Chart.defaults.plugins.tooltip.titleFont = { size: 12, weight: 600 };
Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
Chart.defaults.set('plugins.legend.labels', {
  boxWidth: 9,
  boxHeight: 9,
  padding: 14,
  usePointStyle: false,
});
Chart.defaults.plugins.legend.labels.font = { size: 11.5 };
