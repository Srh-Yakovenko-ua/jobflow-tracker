import { afterEach, describe, expect, it, vi } from 'vitest';

import { fixtureIdOf } from '@/test/board-fixtures';
import { refuseStorage } from '@/test/refusing-storage';
import { ME_RESPONSE } from '@/test/session-fixtures';

import { forgetUserStorage, userStorageKeyOf } from './user-storage';

const USER_ID = ME_RESPONSE.user.id;

const OTHER_USER_ID = fixtureIdOf(901);

const MY_KEYS = [
  `jobflow.recent-applications.${USER_ID}`,
  `jobflow.interview-prep.${USER_ID}`,
  `jobflow.asked-topics.${USER_ID}`,
];

const OTHER_KEY = `jobflow.interview-prep.${OTHER_USER_ID}`;

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('user storage', () => {
  it('keys each stored value by its name and the user, keeping the recents key as it was', () => {
    expect(userStorageKeyOf({ name: 'recent-applications', userId: USER_ID })).toBe(MY_KEYS[0]);
    expect(userStorageKeyOf({ name: 'asked-topics', userId: OTHER_USER_ID })).toBe(
      `jobflow.asked-topics.${OTHER_USER_ID}`,
    );
  });

  it('forgets every value of this user and keeps those of another account', () => {
    for (const key of [...MY_KEYS, OTHER_KEY]) localStorage.setItem(key, '[]');

    forgetUserStorage(USER_ID);

    expect(MY_KEYS.map((key) => localStorage.getItem(key))).toEqual([null, null, null]);
    expect(localStorage.getItem(OTHER_KEY)).toBe('[]');
  });

  it('a storage that refuses to forget does not throw and is logged once', () => {
    const warn = refuseStorage();

    expect(() => {
      forgetUserStorage(USER_ID);
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
