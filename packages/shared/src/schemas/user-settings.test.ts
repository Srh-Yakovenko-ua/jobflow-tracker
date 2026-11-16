import { describe, expect, it } from 'vitest';

import { issuePathsOf } from '../test/zod-issues.js';
import { settingsSuggestionsSchema, updateUserSettingsInputSchema } from './user-settings.js';

const EMPTY_PATCH = [{ path: [], message: 'Send at least one field to change' }];

describe('updateUserSettingsInputSchema', () => {
  it.for([3, 30])('accepts silenceDays %i at the edge of 3 to 30', (silenceDays) => {
    expect(updateUserSettingsInputSchema.parse({ silenceDays })).toEqual({ silenceDays });
  });

  it.for([2, 31, 7.5])('refuses silenceDays %d at silenceDays', (silenceDays) => {
    expect(issuePathsOf(updateUserSettingsInputSchema.safeParse({ silenceDays }))).toEqual([
      'silenceDays',
    ]);
  });

  it.for([{ autoGhostDays: 14 }, { autoGhostDays: 90 }, { autoGhostDays: null }])(
    'accepts autoGhostDays $autoGhostDays',
    (patch) => {
      expect(updateUserSettingsInputSchema.parse(patch)).toEqual(patch);
    },
  );

  it.for([13, 91])('refuses autoGhostDays %i at autoGhostDays', (autoGhostDays) => {
    expect(issuePathsOf(updateUserSettingsInputSchema.safeParse({ autoGhostDays }))).toEqual([
      'autoGhostDays',
    ]);
  });

  it('refuses an empty patch with the hint to send a field', () => {
    expect(updateUserSettingsInputSchema.safeParse({}).error?.issues).toMatchObject(EMPTY_PATCH);
  });

  it('strips a key the settings screen never sends', () => {
    expect(updateUserSettingsInputSchema.parse({ theme: 'dark', colour: 'red' })).toEqual({
      theme: 'dark',
    });
  });

  it('refuses activeResumeVersionId alone as an empty patch', () => {
    const patch = { activeResumeVersionId: '01920000-0000-7000-8000-000000000041' };
    expect(updateUserSettingsInputSchema.safeParse(patch).error?.issues).toMatchObject(EMPTY_PATCH);
  });

  it.for([
    { weeklyGoalApplications: 1 },
    { weeklyGoalApplications: 30 },
    { weeklyGoalApplications: null },
    { weeklyGoalFollowups: 3 },
    { pausedUntil: '2026-12-01' },
    { pausedUntil: null },
  ])('accepts the weekly rhythm patch %o', (patch) => {
    expect(updateUserSettingsInputSchema.parse(patch)).toEqual(patch);
  });

  it.for([
    { weeklyGoalApplications: 0 },
    { weeklyGoalApplications: 31 },
    { weeklyGoalFollowups: 2.5 },
    { pausedUntil: '2026-12-01T00:00:00Z' },
  ])('refuses the weekly rhythm patch %o', (patch) => {
    expect(issuePathsOf(updateUserSettingsInputSchema.safeParse(patch))).toEqual(
      Object.keys(patch),
    );
  });

  it('refuses the server-written pause start and suggested goal as an empty patch', () => {
    const patch = { pausedFrom: '2026-11-16', suggestedWeeklyGoal: 8 };
    expect(updateUserSettingsInputSchema.safeParse(patch).error?.issues).toMatchObject(EMPTY_PATCH);
  });

  it('refuses a theme outside light, dark and system', () => {
    expect(issuePathsOf(updateUserSettingsInputSchema.safeParse({ theme: 'blue' }))).toEqual([
      'theme',
    ]);
  });

  it('refuses a single key shortcuts switch that is not a boolean', () => {
    expect(
      issuePathsOf(updateUserSettingsInputSchema.safeParse({ singleKeyShortcuts: 'off' })),
    ).toEqual(['singleKeyShortcuts']);
  });

  it.for(['Europe/Kyiv', 'UTC', 'America/Argentina/Buenos_Aires', 'Etc/GMT+3'])(
    'accepts the IANA time zone %s',
    (timezone) => {
      expect(updateUserSettingsInputSchema.parse({ timezone })).toEqual({ timezone });
    },
  );

  it.for(['Mars/Phobos', '+03:00', 'europe/kyiv', ''])(
    'refuses the time zone %o at timezone',
    (timezone) => {
      expect(issuePathsOf(updateUserSettingsInputSchema.safeParse({ timezone }))).toEqual([
        'timezone',
      ]);
    },
  );

  it('refuses a well-formed name the IANA database lacks as an unknown time zone', () => {
    expect(
      updateUserSettingsInputSchema.safeParse({ timezone: 'Mars/Phobos' }).error?.issues,
    ).toMatchObject([{ path: ['timezone'], message: 'Unknown IANA time zone' }]);
  });
});

describe('settingsSuggestionsSchema', () => {
  it('accepts the fallback with no median below five answered applications', () => {
    const fallback = { silenceDays: 7, medianResponseDays: null, answeredApplications: 4 };
    expect(settingsSuggestionsSchema.parse(fallback)).toEqual(fallback);
  });
});
