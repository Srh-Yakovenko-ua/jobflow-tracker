import type { Logger } from '@nestjs/common';

import { errorMessageOf } from '../../common/error-message.js';
import { DEPENDENCY_LIMITS } from '../../common/probe.js';
import { jobFields, parsedJob, type ProcessedJob } from '../../queues/processed-job.js';
import { MAINTENANCE_JOBS, uptimePushJobSchema } from './maintenance.jobs.js';

export type UptimePush = { job: ProcessedJob; logger: Logger };

export async function pushUptime({ job, logger }: UptimePush): Promise<void> {
  const { url } = parsedJob(job, {
    name: MAINTENANCE_JOBS.uptimePush,
    schema: uptimePushJobSchema,
    logger,
    label: 'uptime push payload',
  });
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(DEPENDENCY_LIMITS.uptimePushTimeoutMs),
    });
    await response.body?.cancel();
    if (!response.ok) {
      logger.warn({ ...jobFields(job), status: response.status }, 'uptime push failed');
    }
  } catch (error) {
    logger.warn({ ...jobFields(job), err: errorMessageOf(error) }, 'uptime push failed');
  }
}
