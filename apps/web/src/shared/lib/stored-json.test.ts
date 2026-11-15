import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { refuseStorage } from '@/test/refusing-storage';

import { logger } from './logger';
import { readStoredJson, writeStoredJson } from './stored-json';

const KEY = 'jobflow.stored-json-test';

const idsSchema = z.array(z.string());

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('stored json', () => {
  it('reads back what was written', () => {
    writeStoredJson(KEY, ['a', 'b']);

    expect(readStoredJson(KEY, idsSchema)).toEqual(['a', 'b']);
  });

  it('reads nothing when nothing was stored', () => {
    expect(readStoredJson(KEY, idsSchema)).toBeUndefined();
  });

  it.each(['not json', '[1, 2]', '{"ids":[]}'])('a stored %s reads as nothing', (stored) => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    localStorage.setItem(KEY, stored);

    expect(readStoredJson(KEY, idsSchema)).toBeUndefined();
  });

  it('a storage that refuses reads as nothing, writing does not throw, and both are logged', () => {
    const warn = refuseStorage();

    expect(() => {
      writeStoredJson(KEY, ['a']);
    }).not.toThrow();
    expect(readStoredJson(KEY, idsSchema)).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
