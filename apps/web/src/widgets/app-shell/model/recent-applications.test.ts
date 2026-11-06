import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '@/shared/lib/logger';
import { fixtureIdOf } from '@/test/board-fixtures';
import { refuseStorage } from '@/test/refusing-storage';
import { ME_RESPONSE } from '@/test/session-fixtures';

import {
  readRecentApplications,
  type RecentApplication,
  rememberRecentApplication,
} from './recent-applications';

const USER_ID = ME_RESPONSE.user.id;

const OTHER_USER_ID = '0b6f3c1e-5d2a-4c8e-9f10-0000000000bb';

const STORAGE_KEY = `jobflow.recent-applications.${USER_ID}`;

function recentOf(serial: number): RecentApplication {
  return { id: fixtureIdOf(serial), company: `Company ${String(serial)}`, position: 'Frontend' };
}

function remember(...serials: number[]) {
  for (const serial of serials) {
    rememberRecentApplication({ userId: USER_ID, application: recentOf(serial) });
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('recent applications', () => {
  it('lists the newest first and moves a reopened one back to the top once', () => {
    remember(1, 2, 1);

    expect(readRecentApplications(USER_ID)).toEqual([recentOf(1), recentOf(2)]);
  });

  it('keeps the five opened last', () => {
    remember(1, 2, 3, 4, 5, 6, 7);

    expect(readRecentApplications(USER_ID).map((recent) => recent.company)).toEqual([
      'Company 7',
      'Company 6',
      'Company 5',
      'Company 4',
      'Company 3',
    ]);
  });

  it('stores only the id, company and position of what was opened', () => {
    const opened = { ...recentOf(1), currentStage: 'applied' };
    rememberRecentApplication({ userId: USER_ID, application: opened });

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual([recentOf(1)]);
  });

  it('another account on the same browser does not see them', () => {
    remember(1);

    expect(readRecentApplications(OTHER_USER_ID)).toEqual([]);
  });

  it.each(['not json', '[{"id":"1"}]', '{"items":[]}'])('a stored %s reads as none', (stored) => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    localStorage.setItem(STORAGE_KEY, stored);

    expect(readRecentApplications(USER_ID)).toEqual([]);
  });

  it('a storage that refuses reads as none, remembering does not throw, and both are logged', () => {
    const warn = refuseStorage();

    expect(() => {
      remember(1);
    }).not.toThrow();
    expect(readRecentApplications(USER_ID)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(3);
  });
});
