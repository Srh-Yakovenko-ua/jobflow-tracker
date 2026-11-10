import type { DuplicateHint } from './capture.js';
import type { CopyKey } from './copy-uk.js';
import { unpackText } from './packed-text.js';
import { SHARED } from './shared-data.js';

const DAY_MS = 86_400_000;
const LOCALE = 'uk';

export function copyOf(key: CopyKey): string {
  return unpackText(SHARED.copy[key]);
}

export function duplicateMessageOf({ stage, appliedAt }: DuplicateHint, now: Date): string {
  const suffix = `, ${copyOf('stage')}: ${unpackText(SHARED.stageLabels[stage])}`;
  if (appliedAt === null) {
    return copyOf('duplicateUndated') + suffix;
  }
  const days = Math.max(0, Math.floor((now.getTime() - Date.parse(appliedAt)) / DAY_MS));
  const when = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' }).format(-days, 'day');
  return `${copyOf('duplicateDated')} ${when}${suffix}`;
}

export function retryMessageOf(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const when = new Intl.RelativeTimeFormat(LOCALE).format(minutes, 'minute');
  return `${copyOf('rateLimited')} ${when}`;
}
