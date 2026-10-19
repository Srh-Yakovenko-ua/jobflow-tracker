import type { NestExpressApplication } from '@nestjs/platform-express';
import { generateKeyPair, SignJWT } from 'jose';
import request from 'supertest';

import type { User } from '../generated/prisma/client.js';

export const testKeys = await generateKeyPair('RS256');

export function accessTokenFor(user: Pick<User, 'id'>): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(testKeys.privateKey);
}

export async function authAs(app: NestExpressApplication, user: Pick<User, 'id'>) {
  const token = await accessTokenFor(user);
  return request.agent(app.getHttpServer()).set('authorization', `Bearer ${token}`);
}
