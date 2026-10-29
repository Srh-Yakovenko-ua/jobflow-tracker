import type { JobSchedulerTemplateOptions, RepeatOptions } from 'bullmq';
import { z } from 'zod';

export const MAINTENANCE_JOBS = {
  ping: 'ping',
  outboxRelay: 'outbox.relay',
  cleanup: 'maintenance.cleanup',
} as const;

export type MaintenanceJobName = (typeof MAINTENANCE_JOBS)[keyof typeof MAINTENANCE_JOBS];

export type MaintenanceSchedule = {
  id: string;
  repeat: Omit<RepeatOptions, 'key'>;
  template: { name: MaintenanceJobName; opts: JobSchedulerTemplateOptions };
};

const TICK_JOB_OPTIONS = {
  attempts: 1,
  removeOnComplete: true,
  removeOnFail: { count: 100 },
} satisfies JobSchedulerTemplateOptions;

export const MAINTENANCE_SCHEDULES: MaintenanceSchedule[] = [
  {
    id: 'outbox-relay',
    repeat: { every: 500 },
    template: { name: MAINTENANCE_JOBS.outboxRelay, opts: TICK_JOB_OPTIONS },
  },
  {
    id: 'cleanup',
    repeat: { every: 86_400_000 },
    template: { name: MAINTENANCE_JOBS.cleanup, opts: TICK_JOB_OPTIONS },
  },
];

export const maintenanceJobNameSchema = z.enum(MAINTENANCE_JOBS);

export const PING_LIMITS = { maxHoldMs: 60_000 } as const;

export const pingJobSchema = z.object({
  requestId: z.string().min(1),
  holdMs: z.number().int().min(0).max(PING_LIMITS.maxHoldMs).default(0),
});

export const pingBodySchema = pingJobSchema.pick({ holdMs: true });

export const jobAcceptedSchema = z.object({ jobId: z.string().min(1) });

export type PingJob = z.infer<typeof pingJobSchema>;

export type PingBody = z.infer<typeof pingBodySchema>;

export type JobAccepted = z.infer<typeof jobAcceptedSchema>;
