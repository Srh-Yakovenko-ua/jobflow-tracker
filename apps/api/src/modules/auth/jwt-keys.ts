import { readFile } from 'node:fs/promises';

import type { PublicJwk } from '@jobflow/shared';
import {
  calculateJwkThumbprint,
  type CryptoKey,
  exportJWK,
  importPKCS8,
  importSPKI,
  type JWTHeaderParameters,
  type JWTPayload,
  jwtVerify,
  type JWTVerifyOptions,
  SignJWT,
} from 'jose';
import type { z } from 'zod';

export abstract class JwtKeys {
  abstract readonly privateKey: CryptoKey;
  abstract readonly publicKey: CryptoKey;
  abstract readonly jwk: PublicJwk;
}

export type JwtKeyPair = { privateKey: CryptoKey; publicKey: CryptoKey };

export type JwtKeyPaths = { privateKeyPath: string; publicKeyPath: string };

export type SignWithKeysInput = {
  keys: JwtKeys;
  claims: JWTPayload;
  ttlSeconds: number;
  issuedAt: Date;
  header?: Pick<JWTHeaderParameters, 'typ'>;
};

export type VerifyWithKeysInput<Claims> = {
  keys: JwtKeys;
  token: string;
  options: JWTVerifyOptions;
  schema: z.ZodType<Claims>;
  refusal: (error: unknown) => Error;
};

export function signWithKeys({
  keys,
  claims,
  ttlSeconds,
  issuedAt,
  header,
}: SignWithKeysInput): Promise<string> {
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: keys.jwk.kid, ...header })
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + ttlSeconds)
    .sign(keys.privateKey);
}

export async function verifyWithKeys<Claims>({
  keys,
  token,
  options,
  schema,
  refusal,
}: VerifyWithKeysInput<Claims>): Promise<Claims> {
  try {
    const { payload } = await jwtVerify(token, keys.publicKey, options);
    return schema.parse(payload);
  } catch (error) {
    throw refusal(error);
  }
}

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
