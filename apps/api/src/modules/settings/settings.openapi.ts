import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  DEFAULT_SILENCE_DAYS,
  type SettingsSuggestions,
  settingsSuggestionsSchema,
  type UpdateUserSettingsInput,
  updateUserSettingsInputSchema,
  USER_SETTINGS_LIMITS,
  userSettingsSchema,
} from '@jobflow/shared';

import { errorResponses, EXAMPLE_USER_SETTINGS, jsonContent } from '../../openapi/route.js';
import { SILENCE_SUGGESTION } from './settings.service.js';

const SETTINGS_PATH = '/settings';

const TAGS = ['settings'];

const SETTINGS_CHANGE = {
  silenceDays: 10,
  timezone: 'Europe/Warsaw',
  notifyPush: true,
} satisfies UpdateUserSettingsInput;

const SUGGESTIONS = {
  silenceDays: 7,
  medianResponseDays: 6,
  answeredApplications: 12,
} satisfies SettingsSuggestions;

const { silenceDays, autoGhostDays } = USER_SETTINGS_LIMITS;

const LIMITS = `silenceDays ${String(silenceDays.min)} to ${String(silenceDays.max)}, autoGhostDays ${String(autoGhostDays.min)} to ${String(autoGhostDays.max)} or null (off), timezone an IANA name, quiet hours as HH:MM`;

const signedInErrors = errorResponses([401, 403]);

export const SETTINGS_OPENAPI_PATHS: RouteConfig[] = [
  {
    method: 'get',
    path: SETTINGS_PATH,
    tags: TAGS,
    summary: 'The settings of the signed-in user',
    responses: {
      200: {
        description: 'The settings',
        content: jsonContent(userSettingsSchema, EXAMPLE_USER_SETTINGS),
      },
      ...signedInErrors,
    },
  },
  {
    method: 'patch',
    path: SETTINGS_PATH,
    tags: TAGS,
    summary: 'Change some of the settings',
    description:
      'Writes only the sent fields and records settings.changed with their names in the same transaction. activeResumeVersionId is not changed here.',
    request: {
      body: {
        required: true,
        description: `At least one field. ${LIMITS}.`,
        content: jsonContent(updateUserSettingsInputSchema, SETTINGS_CHANGE),
      },
    },
    responses: {
      200: {
        description: 'The settings after the change',
        content: jsonContent(userSettingsSchema, { ...EXAMPLE_USER_SETTINGS, ...SETTINGS_CHANGE }),
      },
      ...errorResponses([400, 401, 403, 422]),
    },
  },
  {
    method: 'get',
    path: `${SETTINGS_PATH}/suggestions`,
    tags: TAGS,
    summary: "A silence threshold from the user's own median response time",
    description: `One day over the whole median days from applied to the first company answer, kept within the silenceDays limits. Fewer than ${String(SILENCE_SUGGESTION.minAnsweredApplications)} answered Applications: ${String(DEFAULT_SILENCE_DAYS)} days and no median.`,
    responses: {
      200: {
        description: 'The suggested silence threshold',
        content: jsonContent(settingsSuggestionsSchema, SUGGESTIONS),
      },
      ...signedInErrors,
    },
  },
];
