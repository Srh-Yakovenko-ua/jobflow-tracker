import { once } from 'node:events';
import { createServer, type IncomingMessage } from 'node:http';
import { gunzipSync } from 'node:zlib';

import { listenLocally } from './tcp-proxy.js';

export const ERROR_LEAK = {
  email: 'ivan.petrenko@example.com',
  note: 'Нотатка: рекрутер обіцяв офер до пʼятниці',
} as const;

const DSN_PUBLIC_KEY = '5f3a9c0e1b2d4e6f8a7b6c5d4e3f2a1b';

export function dsnAt(url: string): string {
  const dsn = new URL(url);
  dsn.username = DSN_PUBLIC_KEY;
  dsn.pathname = '/1';
  return dsn.href;
}

export type ErrorCollector = {
  readonly dsn: string;
  readonly events: () => string[];
  readonly close: () => Promise<void>;
};

async function bodyOf(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  request.on('data', (chunk: Buffer) => chunks.push(chunk));
  await once(request, 'end');
  const body = Buffer.concat(chunks);
  return (request.headers['content-encoding'] === 'gzip' ? gunzipSync(body) : body).toString();
}

export async function startErrorCollector(): Promise<ErrorCollector> {
  const envelopes: string[] = [];
  const server = createServer((request, response) => {
    void bodyOf(request).then((body) => {
      envelopes.push(body);
      response.writeHead(200, { 'content-type': 'application/json' }).end('{}');
    });
  });
  const port = await listenLocally(server);
  return {
    dsn: dsnAt(`http://127.0.0.1:${String(port)}`),
    events: () => envelopes.filter((envelope) => envelope.includes('"type":"event"')),
    close: async () => {
      server.closeAllConnections();
      server.close();
      await once(server, 'close');
    },
  };
}
