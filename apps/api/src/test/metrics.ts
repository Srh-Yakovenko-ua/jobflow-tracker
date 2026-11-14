import type { MetricsRegistry } from '../metrics/metrics-registry.js';

export type MetricSample = { labels: object; value: number };

export async function samplesOf(metrics: MetricsRegistry, name: string): Promise<MetricSample[]> {
  const metric = metrics.registry.getSingleMetric(name);
  if (metric === undefined) {
    throw new Error(`${name} is not registered`);
  }
  const { values } = await metric.get();
  return values.map(({ labels, value }) => ({ labels, value }));
}

export const metricLinesOf = async (metrics: MetricsRegistry, name: string) =>
  (await metrics.registry.getSingleMetricAsString(name)).split('\n');
