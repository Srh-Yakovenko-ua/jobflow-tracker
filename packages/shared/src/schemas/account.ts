import { z } from 'zod';

import { givenPasswordSchema } from './auth.js';

export const EXPORT_FORMATS = ['json', 'csv'] as const;

export const EXPORT_LIMITS = { linkTtlSeconds: 3600 } as const;

export const exportFormatSchema = z.enum(EXPORT_FORMATS);

export const exportRequestSchema = z.object({ format: exportFormatSchema });

export const exportAcceptedSchema = z.object({ exportId: z.uuid() });

export const readyExportLinkSchema = z.object({
  status: z.literal('ready'),
  url: z.url(),
  expiresAt: z.iso.datetime(),
});

export const exportLinkSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending') }),
  readyExportLinkSchema,
]);

export const deleteAccountInputSchema = z.object({ password: givenPasswordSchema });

export type ExportFormat = z.infer<typeof exportFormatSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type ExportAccepted = z.infer<typeof exportAcceptedSchema>;
export type ReadyExportLink = z.infer<typeof readyExportLinkSchema>;
export type ExportLink = z.infer<typeof exportLinkSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;
