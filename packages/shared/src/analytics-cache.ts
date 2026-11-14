export const ANALYTICS_CACHE = {
  versionKey: 'analytics:{userId}:version',
  entryKey: 'analytics:{userId}:v{version}:{metric}:{paramsHash}',
  ttlSeconds: 3600,
} as const;

export const analyticsVersionKey = (userId: string): string =>
  ANALYTICS_CACHE.versionKey.replace('{userId}', userId);
