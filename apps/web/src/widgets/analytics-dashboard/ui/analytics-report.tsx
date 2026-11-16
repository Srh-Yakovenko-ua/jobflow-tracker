'use client';

import { useState } from 'react';

import { PrintCharts } from '@/shared/lib/chart';
import { PrintSheet } from '@/shared/ui/print-sheet';

import { useDashboardModel } from '../model/use-dashboard-model';
import { DashboardBlocks } from './dashboard-blocks';
import { ReportInsights } from './report-insights';
import { ReportTitle } from './report-title';
import { ReportToolbar } from './report-toolbar';

export type AnalyticsReportProps = Readonly<{ period?: string | undefined }>;

export function AnalyticsReport({ period }: AnalyticsReportProps) {
  const model = useDashboardModel(period);
  const [hideSalary, setHideSalary] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ReportToolbar salary={{ hidden: hideSalary, onHiddenChange: setHideSalary }} />
      <PrintSheet>
        <PrintCharts>
          <ReportTitle scope={model.scope} />
          <DashboardBlocks model={model} layout="report" />
          <ReportInsights
            queries={model.queries}
            view={{ hideSalary, activeSearch: model.scope.searchId === model.scope.activeId }}
          />
        </PrintCharts>
      </PrintSheet>
    </div>
  );
}
