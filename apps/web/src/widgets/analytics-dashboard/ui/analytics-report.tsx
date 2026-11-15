'use client';

import { useState } from 'react';

import { PrintCharts } from '@/shared/lib/chart';
import { LightScheme } from '@/shared/lib/theme';

import { useDashboardModel } from '../model/use-dashboard-model';
import { DashboardBlocks } from './dashboard-blocks';
import { ReportInsights } from './report-insights';
import { ReportTitle } from './report-title';
import { ReportToolbar } from './report-toolbar';

const SHEET =
  'mx-auto flex w-full max-w-[210mm] min-w-0 flex-col gap-6 rounded-xl p-8 shadow-e2 max-sm:p-4 print:max-w-none print:rounded-none print:p-0 print:bg-transparent print:shadow-none print:[print-color-adjust:exact]';

export type AnalyticsReportProps = Readonly<{ period?: string | undefined }>;

export function AnalyticsReport({ period }: AnalyticsReportProps) {
  const model = useDashboardModel(period);
  const [hideSalary, setHideSalary] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ReportToolbar salary={{ hidden: hideSalary, onHiddenChange: setHideSalary }} />
      <LightScheme className={SHEET}>
        <PrintCharts>
          <ReportTitle scope={model.scope} />
          <DashboardBlocks model={model} layout="report" />
          <ReportInsights
            queries={model.queries}
            view={{ hideSalary, activeSearch: model.scope.searchId === model.scope.activeId }}
          />
        </PrintCharts>
      </LightScheme>
    </div>
  );
}
