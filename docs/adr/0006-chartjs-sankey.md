# ADR-0006: Chart.js 4 with chartjs-chart-sankey

- Status: accepted
- Date: 2026-10-18

## Context

The dashboard is the centre of the thesis: a Sankey funnel, rejection reasons by stage, source performance, a forecast with an interval. The same charts go into a shareable image and a printable report, and they must follow the design tokens in light and dark themes.

## Decision

Charts use Chart.js 4 through react-chartjs-2, with the `chartjs-chart-sankey` plugin for the funnel. A global theme is generated from the tokens (`chart-theme.ts`), and a `<ChartFrame>` wrapper owns the loading, low data and error states.

## Alternatives

- **Recharts**: React friendly, but it has no Sankey chart.
- **D3**: can draw anything, but every chart becomes custom code to write, test and theme.
- **ECharts**: has a Sankey, but the bundle is heavy for a handful of charts.

## Consequences

- Better: a ready Sankey, canvas rendering that stays fast with many points, image export for the share card and the print report.
- Worse: canvas charts need extra work for screen readers, and the API is imperative under the React wrapper.
- Watch: accessibility of canvas charts (the FIN-03 audit covers it), and colours that come only from the token theme.

## Links

FE-32, FE-34, FE-35, FE-36, FE-37, FE-48, FE-49, DES-02, FIN-03. DOC-06.
