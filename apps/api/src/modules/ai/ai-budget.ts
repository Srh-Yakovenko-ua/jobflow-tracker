import { QUEUES } from '../../queues/queues.js';
import type { BudgetWindow, QueueSample } from './ai.repository.js';

export const AI_QUEUE_ESTIMATE = { sampleSize: 50, fallbackLatencyMs: 10_000 } as const;

export type AiQueuePosition = { ahead: number; etaSeconds: number };

export function budgetWindow(now: Date): BudgetWindow {
  const [year, month] = [now.getUTCFullYear(), now.getUTCMonth()];
  return {
    dayStart: new Date(Date.UTC(year, month, now.getUTCDate())),
    monthStart: new Date(Date.UTC(year, month, 1)),
  };
}

function averageLatencyMs(latencies: number[]): number {
  if (latencies.length === 0) {
    return AI_QUEUE_ESTIMATE.fallbackLatencyMs;
  }
  return latencies.reduce((total, latency) => total + latency, 0) / latencies.length;
}

export function queueEstimate({ ahead, latencies }: QueueSample): AiQueuePosition {
  const rounds = Math.ceil((ahead + 1) / QUEUES.ai.concurrency);
  return { ahead, etaSeconds: Math.ceil((rounds * averageLatencyMs(latencies)) / 1000) };
}
