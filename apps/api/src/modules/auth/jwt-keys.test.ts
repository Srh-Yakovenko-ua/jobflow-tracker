import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { calculateJwkThumbprint, jwtVerify, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';

import { type JwtKeyPaths, loadJwtKeys } from './jwt-keys.js';

async function writeKeyPair(): Promise<JwtKeyPaths> {
  const directory = await mkdtemp(join(tmpdir(), 'jobflow-jwt-keys-'));
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const paths = {
    privateKeyPath: join(directory, 'jwt-private'),
    publicKeyPath: join(directory, 'jwt-public'),
  };
  await writeFile(paths.privateKeyPath, privateKey);
  await writeFile(paths.publicKeyPath, publicKey);
  return paths;
}

describe('loadJwtKeys', () => {
  let paths: JwtKeyPaths;

  beforeAll(async () => {
    paths = await writeKeyPair();
  });

  it('loads a PEM key pair that signs and verifies an RS256 token', async () => {
    const keys = await loadJwtKeys(paths);

    const token = await new SignJWT({}).setProtectedHeader({ alg: 'RS256' }).sign(keys.privateKey);

    const { protectedHeader } = await jwtVerify(token, keys.publicKey);
    expect(protectedHeader).toEqual({ alg: 'RS256' });
  });

  it('publishes only the public RSA parameters, alg RS256, use sig and the thumbprint as kid', async () => {
    const { jwk } = await loadJwtKeys(paths);

    expect(Object.keys(jwk).sort()).toEqual(['alg', 'e', 'kid', 'kty', 'n', 'use']);
    expect(jwk).toMatchObject({ kty: 'RSA', e: 'AQAB', alg: 'RS256', use: 'sig' });
    expect(jwk.kid).toBe(await calculateJwkThumbprint({ kty: 'RSA', n: jwk.n, e: jwk.e }));
  });

  it('refuses to start without the public key file and names its path', async () => {
    const missing = join(tmpdir(), 'jobflow-no-such-jwt-key');

    await expect(loadJwtKeys({ ...paths, publicKeyPath: missing })).rejects.toThrow(missing);
  });
});
