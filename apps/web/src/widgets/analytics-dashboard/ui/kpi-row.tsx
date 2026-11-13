import { uk } from '@/shared/i18n';

import { ghostKpi, responseKpi, screeningKpi, sentKpi } from '../lib/kpi-values';
import type { DashboardKpi } from '../model/dashboard-view';
import { KpiTile, type KpiTileProps } from './kpi-tile';

const KPI = uk.analytics.kpi;

export const KPI_GRID = 'grid grid-cols-[repeat(auto-fit,minmax(min(224px,100%),1fr))] gap-3.5';

export type KpiRowProps = Readonly<{ kpi: DashboardKpi; silenceDays: number }>;

export function KpiRow({ kpi, silenceDays }: KpiRowProps) {
  const funnel = kpi.funnel.data;
  const timings = kpi.timings.data;
  const tiles: readonly KpiTileProps[] = [
    { label: KPI.sent.label, state: kpi.funnel.state, content: funnel && sentKpi(funnel.kpis) },
    {
      label: KPI.screening.label,
      state: kpi.funnel.state,
      content: funnel && screeningKpi(funnel),
    },
    {
      label: KPI.response.label,
      state: kpi.timings.state,
      content: timings && responseKpi({ timings, silenceDays }),
    },
    { label: KPI.ghost.label, state: kpi.timings.state, content: timings && ghostKpi(timings) },
  ];
  return (
    <div className={KPI_GRID}>
      {tiles.map((tile) => (
        <KpiTile key={tile.label} {...tile} />
      ))}
    </div>
  );
}
