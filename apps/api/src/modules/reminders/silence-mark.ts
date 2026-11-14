import type { SilenceMarkRow } from './silence.repository.js';

export type SilenceMark = { lastEventAt: Date; latestEventAt: Date | null };

export const silenceMarkOf = ({ lastEventAt, stageEvents }: SilenceMarkRow): SilenceMark => ({
  lastEventAt,
  latestEventAt: stageEvents[0]?.createdAt ?? null,
});

export const sameSilenceMark = (seen: SilenceMark, current: SilenceMark) =>
  seen.lastEventAt.getTime() === current.lastEventAt.getTime() &&
  seen.latestEventAt?.getTime() === current.latestEventAt?.getTime();
