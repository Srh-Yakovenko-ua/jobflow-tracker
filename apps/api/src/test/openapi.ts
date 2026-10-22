import type { NestExpressApplication } from '@nestjs/platform-express';
import { z } from 'zod';

import { API_DOCS_PATH } from '../openapi/api-docs.js';
import type { RouteCall } from './http.js';

const METHODS = ['get', 'post', 'patch', 'delete'] as const satisfies RouteCall['method'][];

const serversSchema = z.tuple([z.object({ url: z.string() })]);

const operationSchema = z.object({
  security: z.array(z.record(z.string(), z.array(z.string()))).optional(),
  servers: serversSchema.optional(),
});

const documentSchema = z.object({
  servers: serversSchema,
  paths: z.record(z.string(), z.partialRecord(z.enum(METHODS), operationSchema)),
});

export type DocumentedOperation = {
  method: RouteCall['method'];
  path: string;
  bearer: boolean;
};

function expressPath(serverUrl: string, path: string): string {
  return `${serverUrl.replace(/\/$/, '')}${path}`.replaceAll(/\{(\w+)\}/g, ':$1');
}

export function documentedOperations(document: unknown): DocumentedOperation[] {
  const {
    servers: [root],
    paths,
  } = documentSchema.parse(document);
  return Object.entries(paths).flatMap(([path, item]) =>
    METHODS.flatMap((method) => {
      const operation = item[method];
      if (operation === undefined) {
        return [];
      }
      const [server] = operation.servers ?? [root];
      const bearer = operation.security === undefined;
      return [{ method, path: expressPath(server.url, path), bearer }];
    }),
  );
}

export type OperationRef = { method: string; path: string };

export const operationKey = ({ method, path }: OperationRef) => `${method.toUpperCase()} ${path}`;

const routeLayersSchema = z.array(
  z.object({
    route: z.object({ path: z.string(), methods: z.record(z.string(), z.boolean()) }).optional(),
  }),
);

export function registeredOperations(app: NestExpressApplication): string[] {
  const { stack } = app.getHttpAdapter().getInstance().router;
  return routeLayersSchema.parse(stack).flatMap(({ route }) => {
    const [method, ...otherMethods] = Object.keys(route?.methods ?? {});
    return route === undefined ||
      method === undefined ||
      otherMethods.length > 0 ||
      route.path.startsWith(API_DOCS_PATH)
      ? []
      : [operationKey({ method, path: route.path })];
  });
}
