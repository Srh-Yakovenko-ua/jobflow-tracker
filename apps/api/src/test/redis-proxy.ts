import { once } from 'node:events';
import { connect, createServer, type Server, type Socket } from 'node:net';

export type RedisProxy = { readonly url: string; silence(): void; close(): Promise<void> };

const DEFAULT_REDIS_PORT = 6379;

function listeningPort(server: Server): number {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('the Redis proxy is not listening on a TCP port');
  }
  return address.port;
}

export async function startRedisProxy(target: string): Promise<RedisProxy> {
  const upstream = new URL(target);
  const sockets = new Set<Socket>();
  let silent = false;
  const server = createServer((client) => {
    const redis = connect(Number(upstream.port || DEFAULT_REDIS_PORT), upstream.hostname);
    for (const socket of [client, redis]) {
      sockets.add(socket.on('error', () => socket.destroy()));
    }
    client.pipe(redis);
    redis.on('data', (reply: Buffer) => {
      if (!silent) client.write(reply);
    });
    redis.on('close', () => client.destroy());
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = new URL(target);
  url.hostname = '127.0.0.1';
  url.port = String(listeningPort(server));
  return {
    url: url.href,
    silence: () => {
      silent = true;
    },
    close: async () => {
      sockets.forEach((socket) => socket.destroy());
      server.close();
      await once(server, 'close');
    },
  };
}
