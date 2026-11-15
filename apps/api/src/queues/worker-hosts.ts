import { WorkerHost } from '@nestjs/bullmq';
import type { DiscoveryService } from '@nestjs/core';

const isWorkerHost = (provided: unknown): provided is WorkerHost => provided instanceof WorkerHost;

export function workerHostsOf(discovery: DiscoveryService): WorkerHost[] {
  return discovery
    .getProviders()
    .map(({ instance }): unknown => instance)
    .filter(isWorkerHost);
}
