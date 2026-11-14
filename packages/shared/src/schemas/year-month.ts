import { z } from 'zod';

export const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export type YearMonth = z.infer<typeof yearMonthSchema>;
