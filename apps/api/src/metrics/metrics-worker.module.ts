import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { JobMetrics } from './job-metrics.js';
import { queueMetrics } from './queue-metrics.js';
import { WorkerMetricsServer } from './worker-metrics-server.js';

@Module({
  imports: [DiscoveryModule],
  providers: [WorkerMetricsServer, queueMetrics, JobMetrics],
})
export class MetricsWorkerModule {}
