import { userSettingsPatchSchema } from '@jobflow/shared';
import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';

export const SETTINGS_EVENTS = { changed: 'settings.changed' } as const;

export const settingsFieldSchema = userSettingsPatchSchema.keyof();

export const settingsChangedPayloadSchema = z.object({
  userId: z.uuid(),
  fields: z.array(settingsFieldSchema).min(1),
});

export type SettingsField = z.infer<typeof settingsFieldSchema>;

export type SettingsChangedPayload = z.infer<typeof settingsChangedPayloadSchema>;

export type SettingsEvent = { eventType: typeof SETTINGS_EVENTS.changed } & Omit<
  SettingsChangedPayload,
  'userId'
>;

export function settingsChangedEvent(
  userId: string,
  fields: SettingsField[],
): Prisma.OutboxEventCreateInput {
  return {
    aggregate: 'settings',
    aggregateId: userId,
    eventType: SETTINGS_EVENTS.changed,
    payload: { userId, fields },
  };
}
