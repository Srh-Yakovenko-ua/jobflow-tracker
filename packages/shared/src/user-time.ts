import { TZDate } from '@date-fns/tz';

import type { UserSettings } from './schemas/user-settings.js';

export const userNow = (settings: Pick<UserSettings, 'timezone'>, now: Date): TZDate =>
  new TZDate(now, settings.timezone);
