import {
  type UpdateUserSettingsInput,
  type UserSettings,
  userSettingsSchema,
} from '@jobflow/shared';

import { apiClient } from '@/shared/api';

export function updateSettings(body: UpdateUserSettingsInput): Promise<UserSettings> {
  return apiClient.request({
    path: '/settings',
    method: 'PATCH',
    body,
    schema: userSettingsSchema,
  });
}
