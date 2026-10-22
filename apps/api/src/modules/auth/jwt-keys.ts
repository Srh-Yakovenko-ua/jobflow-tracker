import { readFile } from 'node:fs/promises';

import type { PublicJwk } from '@jobflow/shared';
import { calculateJwkThumbprint, type CryptoKey, exportJWK, importPKCS8, importSPKI } from 'jose';

export abstract class JwtKeys {
  abstract readonly privateKey: CryptoKey;
  abstract readonly publicKey: CryptoKey;
  abstract readonly jwk: PublicJwk;
}

export type JwtKeyPair = { privateKey: CryptoKey; publicKey: CryptoKey };

export type JwtKeyPaths = { privateKeyPath: string; publicKeyPath: string };

async function publicJwkOf(publicKey: CryptoKey): Promise<PublicJwk> {
  const { kty, n, e } = await exportJWK(publicKey);
  if (kty !== 'RSA' || n === undefined || e === undefined) {
    throw new Error('The JWT public key is not an RSA key');
  }
  const kid = await calculateJwkThumbprint({ kty, n, e });
  return { kty: 'RSA', n, e, kid, alg: 'RS256', use: 'sig' };
}

export async function jwtKeysFrom({ privateKey, publicKey }: JwtKeyPair): Promise<JwtKeys> {
  return { privateKey, publicKey, jwk: await publicJwkOf(publicKey) };
}

export async function loadJwtKeys({
  privateKeyPath,
  publicKeyPath,
}: JwtKeyPaths): Promise<JwtKeys> {
  const privatePem = await readFile(privateKeyPath, 'utf8');
  const publicPem = await readFile(publicKeyPath, 'utf8');
  return jwtKeysFrom({
    privateKey: await importPKCS8(privatePem, 'RS256'),
    publicKey: await importSPKI(publicPem, 'RS256', { extractable: true }),
  });
}
