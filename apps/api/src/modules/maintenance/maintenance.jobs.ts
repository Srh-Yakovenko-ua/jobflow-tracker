import type { JobSchedulerTemplateOptions, RepeatOptions } from 'bullmq';
import { milliseconds } from 'date-fns';
import { z } from 'zod';

export const MAINTENANCE_JOBS = {
  ping: 'ping',
  outboxRelay: 'outbox.relay',
  cleanup: 'maintenance.cleanup',
  silenceScan: 'silence.scan',
  autoGhostScan: 'auto-ghost.scan',
  eventRemindersScan: 'event-reminders.scan',
  monthlySummaryPick: 'monthly-summary.pick',
  aiJobsSweep: 'ai-jobs.sweep',
} as const;

export type MaintenanceJobName = (typeof MAINTENANCE_JOBS)[keyof typeof MAINTENANCE_JOBS];

export const MAINTENANCE_SCHEDULE_IDS = {
  outboxRelay: 'outbox-relay',
  cleanup: 'cleanup',
  silenceScan: 'silence-scan',
  autoGhostScan: 'auto-ghost-scan',
  eventReminders: 'scheduled-event-reminders',
  monthlySummary: 'monthly-summary',
  aiJobsSweep: 'ai-jobs-sweep',
} as const;

export const maintenanceScheduleIdSchema = z.enum(MAINTENANCE_SCHEDULE_IDS);

export const scheduleParamsSchema = z.object({
  schedule: maintenanceScheduleIdSchema.meta({ example: MAINTENANCE_SCHEDULE_IDS.silenceScan }),
});

export type MaintenanceScheduleId = z.infer<typeof maintenanceScheduleIdSchema>;

export type MaintenanceSchedule = {
  id: MaintenanceScheduleId;
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
    id: MAINTENANCE_SCHEDULE_IDS.outboxRelay,
    repeat: { every: 500 },
    template: { name: MAINTENANCE_JOBS.outboxRelay, opts: TICK_JOB_OPTIONS },
  },
  {
    id: MAINTENANCE_SCHEDULE_IDS.cleanup,
    repeat: { every: milliseconds({ days: 1 }) },
    template: { name: MAINTENANCE_JOBS.cleanup, opts: TICK_JOB_OPTIONS },
  },
  {
    id: MAINTENANCE_SCHEDULE_IDS.silenceScan,
    repeat: { every: milliseconds({ minutes: 15 }) },
    template: { name: MAINTENANCE_JOBS.silenceScan, opts: TICK_JOB_OPTIONS },
  },
  {
    id: MAINTENANCE_SCHEDULE_IDS.autoGhostScan,
    repeat: { every: milliseconds({ hours: 1 }) },
    template: { name: MAINTENANCE_JOBS.autoGhostScan, opts: TICK_JOB_OPTIONS },
  },
  {
    id: MAINTENANCE_SCHEDULE_IDS.eventReminders,
    repeat: { every: milliseconds({ minutes: 5 }) },
    template: { name: MAINTENANCE_JOBS.eventRemindersScan, opts: TICK_JOB_OPTIONS },
  },
  {
    id: MAINTENANCE_SCHEDULE_IDS.monthlySummary,
    repeat: { pattern: '0 * * * *', tz: 'UTC' },
    template: { name: MAINTENANCE_JOBS.monthlySummaryPick, opts: TICK_JOB_OPTIONS },
  },
  {
    id: MAINTENANCE_SCHEDULE_IDS.aiJobsSweep,
    repeat: { every: milliseconds({ minutes: 15 }) },
    template: { name: MAINTENANCE_JOBS.aiJobsSweep, opts: TICK_JOB_OPTIONS },
  },
];

export const maintenanceJobNameSchema = z.enum(MAINTENANCE_JOBS);

export const PING_LIMITS = { maxHoldMs: milliseconds({ minutes: 1 }) } as const;

export const pingJobSchema = z.object({
  requestId: z.string().min(1),
  holdMs: z.number().int().min(0).max(PING_LIMITS.maxHoldMs).default(0),
});

export const pingBodySchema = pingJobSchema.pick({ holdMs: true });

export const jobAcceptedSchema = z.object({ jobId: z.string().min(1) });

export type PingJob = z.infer<typeof pingJobSchema>;

export type PingBody = z.infer<typeof pingBodySchema>;

export type JobAccepted = z.infer<typeof jobAcceptedSchema>;
