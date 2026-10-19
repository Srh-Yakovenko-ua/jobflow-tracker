import { beforeAll, describe, expect, it } from 'vitest';

import { PasswordHasher } from './password-hasher.js';

const OWASP_ARGON2ID_PREFIX = /^\$argon2id\$v=19\$m=19456,p=1,t=2\$/;

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  beforeAll(async () => {
    await hasher.onModuleInit();
  });

  it('hashes with argon2id at 19 MiB, two iterations and one lane', async () => {
    const digest = await hasher.hash('correct horse battery');

    expect(digest).toMatch(OWASP_ARGON2ID_PREFIX);
  });

  it('verifies the password it hashed and refuses another one', async () => {
    const digest = await hasher.hash('correct horse battery');

    expect(await hasher.verify(digest, 'correct horse battery')).toBe(true);
    expect(await hasher.verify(digest, 'wrong horse battery')).toBe(false);
  });

  it('keeps a dummy hash built with the same parameters', () => {
    expect(hasher.dummyHash).toMatch(OWASP_ARGON2ID_PREFIX);
  });
});
