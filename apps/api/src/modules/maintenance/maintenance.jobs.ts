import { z } from 'zod';

export const MAINTENANCE_JOBS = { ping: 'ping' } as const;

export const PING_LIMITS = { maxHoldMs: 60_000 } as const;

export const pingJobSchema = z.object({
  requestId: z.string().min(1),
  holdMs: z.number().int().min(0).max(PING_LIMITS.maxHoldMs).default(0),
});

export const pingBodySchema = pingJobSchema.pick({ holdMs: true });

export type PingJob = z.infer<typeof pingJobSchema>;

export type PingBody = z.infer<typeof pingBodySchema>;

export type JobAccepted = { jobId: string };
