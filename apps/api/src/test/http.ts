import { errorResponseSchema } from '@jobflow/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request, { type Response } from 'supertest';

export type RouteCall = {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  body?: object | undefined;
  accessToken?: string | undefined;
  headers?: Record<string, string> | undefined;
};

export function callRoute(
  app: NestExpressApplication,
  { method, path, body, accessToken, headers = {} }: RouteCall,
) {
  const call = request(app.getHttpServer())[method](path).set(headers);
  const authorized =
    accessToken === undefined ? call : call.set('authorization', `Bearer ${accessToken}`);
  return body === undefined ? authorized : authorized.send(body);
}

export const errorPathsOf = (body: unknown) =>
  (errorResponseSchema.parse(body).errors ?? []).map(({ path }) => path);

export const statusAndDetail = ({ status, body }: Response) => [
  status,
  errorResponseSchema.safeParse(body).data?.detail,
];

export const statusAndType = ({ status, body }: Pick<Response, 'status' | 'body'>) => [
  status,
  errorResponseSchema.parse(body).type,
];
