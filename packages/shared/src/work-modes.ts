import { z } from 'zod';

export const WORK_MODES = ['remote', 'hybrid', 'office'] as const;

export const workModeSchema = z.enum(WORK_MODES);

export type WorkMode = z.infer<typeof workModeSchema>;
