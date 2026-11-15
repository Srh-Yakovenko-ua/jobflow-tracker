'use client';

import type { Summary } from '@jobflow/shared';
import { AnimatePresence } from 'motion/react';

import { uk } from '@/shared/i18n';
import { monthNameOf } from '@/shared/lib/year-month';
import { ChartFrame } from '@/shared/ui/chart-frame';
import { chartFrameStateOf } from '@/shared/ui/chart-frame-state';
import { Fade } from '@/shared/ui/fade';

import { redactMoney } from '../lib/redact-money';
import type { DashboardQueries } from '../model/use-dashboard-queries';

const COPY = uk.analytics.report.insights;

export type ReportInsightsView = Readonly<{ hideSalary: boolean; activeSearch: boolean }>;

export type ReportInsightsProps = Readonly<{
  queries: Pick<DashboardQueries, 'insights' | 'summary'>;
  view: ReportInsightsView;
}>;

type SummaryTextProps = Readonly<{ summary: Summary; view: ReportInsightsView }>;

function SummaryText({ summary, view }: SummaryTextProps) {
  return (
    <div className="flex flex-col gap-2 break-inside-avoid">
      <span className="eyebrow text-ink-3">
        {uk.summary.eyebrowMonth(monthNameOf(summary.month))}
      </span>
      <p className="text-[13.5px] leading-[1.6] whitespace-pre-line text-ink">
        {view.hideSalary ? redactMoney(summary.text) : summary.text}
      </p>
    </div>
  );
}

export function ReportInsights({ queries, view }: ReportInsightsProps) {
  const insights = (queries.insights.data?.insights ?? []).filter(
    ({ block }) => !view.hideSalary || block !== 'salary',
  );
  const summary = view.activeSearch ? queries.summary.data?.summary : null;
  return (
    <div className="min-w-0 print:break-before-page">
      <ChartFrame
        header={{ eyebrow: COPY.eyebrow, title: COPY.title }}
        state={chartFrameStateOf(queries.insights)}
        view={{ plot: 'open' }}
      >
        <div className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {insights.map(({ block, title, body }) => (
              <Fade
                key={`${block}:${title}`}
                motion={{ layout: 'position' }}
                className="flex flex-col gap-1 break-inside-avoid"
              >
                <h3 className="text-[14.5px] leading-[1.35] font-semibold text-ink">{title}</h3>
                <p className="text-[13px] leading-[1.55] text-pretty text-ink-2">{body}</p>
              </Fade>
            ))}
            {insights.length === 0 && summary === null && (
              <Fade key="empty">
                <p className="text-[13px] leading-[1.55] text-ink-3">{COPY.empty}</p>
              </Fade>
            )}
          </AnimatePresence>
          {summary && <SummaryText summary={summary} view={view} />}
        </div>
      </ChartFrame>
    </div>
  );
}
