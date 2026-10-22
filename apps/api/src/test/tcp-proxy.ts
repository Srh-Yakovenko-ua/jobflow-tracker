import { once } from 'node:events';
import { connect, createServer, type Server, type Socket } from 'node:net';

export type TcpProxy = { readonly url: string; silence(): void; close(): Promise<void> };

const DEFAULT_PORTS: Partial<Record<string, number>> = {
  'redis:': 6379,
  'postgres:': 5432,
  'postgresql:': 5432,
};

function listeningPort(server: Server): number {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('the TCP proxy is not listening on a TCP port');
  }
  return address.port;
}

function upstreamPort(upstream: URL): number {
  const port = upstream.port === '' ? DEFAULT_PORTS[upstream.protocol] : Number(upstream.port);
  if (port === undefined) {
    throw new Error(`the TCP proxy knows no default port for ${upstream.protocol}`);
  }
  return port;
}

export async function startTcpProxy(target: string): Promise<TcpProxy> {
  const upstream = new URL(target);
  const port = upstreamPort(upstream);
  const sockets = new Set<Socket>();
  let silent = false;
  const server = createServer((client) => {
    const service = connect(port, upstream.hostname);
    for (const socket of [client, service]) {
      sockets.add(socket.on('error', () => socket.destroy()));
    }
    client.pipe(service);
    service.on('data', (reply: Buffer) => {
      if (!silent) client.write(reply);
    });
    service.on('close', () => client.destroy());
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
