import type { NestExpressApplication } from '@nestjs/platform-express';

export type SseFrame = {
  id?: string;
  event?: string;
  data?: string;
  comment?: string;
  receivedAt: number;
};

export type SseRequest = { path: string; headers?: Record<string, string> | undefined };

export type SseStream = {
  readonly status: number;
  header(name: string): string | null;
  readonly frames: SseFrame[];
  readonly ended: Promise<void>;
  errorBody(): Promise<unknown>;
  close(): Promise<void>;
};

export type HttpReply = { status: number; body: unknown; get(name: string): string | undefined };

const FIELDS = ['id', 'event', 'data'] as const;

const listening = new WeakMap<NestExpressApplication, Promise<string>>();

export function listeningUrlOf(app: NestExpressApplication): Promise<string> {
  const known = listening.get(app);
  if (known) return known;
  const url = app.listen(0, '127.0.0.1').then(() => app.getUrl());
  listening.set(app, url);
  return url;
}

function frameOf(block: string): SseFrame {
  const frame: SseFrame = { receivedAt: Date.now() };
  for (const line of block.split('\n')) {
    if (line.startsWith(': ')) frame.comment = line.slice(2);
    const field = FIELDS.find((name) => line.startsWith(`${name}: `));
    if (field) frame[field] = line.slice(field.length + 2);
  }
  return frame;
}

async function readFrames(body: ReadableStream<Uint8Array>, frames: SseFrame[]): Promise<void> {
  const decoder = new TextDecoder();
  let pending = '';
  try {
    for await (const chunk of body) {
      const blocks = (pending + decoder.decode(chunk, { stream: true })).split('\n\n');
      pending = blocks.pop() ?? '';
      frames.push(...blocks.filter((block) => block.trim() !== '').map(frameOf));
    }
  } catch {
    return;
  }
}

export async function openSse(
  app: NestExpressApplication,
  { path, headers = {} }: SseRequest,
): Promise<SseStream> {
  const abort = new AbortController();
  const url = `${await listeningUrlOf(app)}${path}`;
  const response = await fetch(url, { headers, signal: abort.signal });
  const frames: SseFrame[] = [];
  const ended =
    response.ok && response.body ? readFrames(response.body, frames) : Promise.resolve();
  return {
    status: response.status,
    header: (name) => response.headers.get(name),
    frames,
    ended,
    errorBody: () => response.json(),
    close: async () => {
      abort.abort();
      await ended;
    },
  };
}

export async function replyOf(stream: SseStream): Promise<HttpReply> {
  return {
    status: stream.status,
    body: stream.status === 200 ? undefined : await stream.errorBody(),
    get: (name) => stream.header(name) ?? undefined,
  };
}
