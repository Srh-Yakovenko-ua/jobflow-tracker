'use client';

import { Chart } from 'chart.js';
import { createContext, type ReactNode, use, useEffect } from 'react';

export const CHART_PRINT = { pixelRatio: 3 } as const;

const PRINT_EVENTS = ['beforeprint', 'afterprint'] as const;

const PrintChartsContext = createContext(false);

function resizeCharts() {
  for (const chart of Object.values(Chart.instances)) chart.resize();
}

export type PrintChartsProps = Readonly<{ children: ReactNode }>;

export function PrintCharts({ children }: PrintChartsProps) {
  useEffect(() => {
    for (const event of PRINT_EVENTS) window.addEventListener(event, resizeCharts);
    return () => {
      for (const event of PRINT_EVENTS) window.removeEventListener(event, resizeCharts);
    };
  }, []);
  return <PrintChartsContext value>{children}</PrintChartsContext>;
}

export function usePrintCharts(): boolean {
  return use(PrintChartsContext);
}
