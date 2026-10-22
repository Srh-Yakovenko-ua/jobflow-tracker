import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

export type RouteCall = {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  body?: object | undefined;
  accessToken?: string | undefined;
};

export function callRoute(
  app: NestExpressApplication,
  { method, path, body, accessToken }: RouteCall,
) {
  const call = request(app.getHttpServer())[method](path);
  const authorized =
    accessToken === undefined ? call : call.set('authorization', `Bearer ${accessToken}`);
  return body === undefined ? authorized : authorized.send(body);
}
