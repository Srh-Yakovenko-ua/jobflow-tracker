import { afterEach } from 'vitest';

import { type SilentServer, startSilentServer } from './tcp-proxy.js';

export function useSilentServers(): () => Promise<SilentServer> {
  const started: SilentServer[] = [];
  afterEach(async () => {
    await Promise.all(started.splice(0).map((server) => server.close()));
  });
  return async () => {
    const server = await startSilentServer();
    started.push(server);
    return server;
  };
}
