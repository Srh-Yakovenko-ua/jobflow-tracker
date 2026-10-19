import { z } from 'zod';

export const THEMES = ['light', 'dark', 'system'] as const;

export const themeSchema = z.enum(THEMES);

export type Theme = z.infer<typeof themeSchema>;
