export const ANALYTICS_ANCHORS = {
  kpis: 'kpis',
  funnel: 'funnel',
  reasons: 'reasons',
  sources: 'sources',
  resumeAb: 'resume-ab',
  forecast: 'forecast',
} as const;

export type AnalyticsBlock = keyof typeof ANALYTICS_ANCHORS;

export function analyticsHref(block: AnalyticsBlock): string {
  return `/analytics#${ANALYTICS_ANCHORS[block]}`;
}
