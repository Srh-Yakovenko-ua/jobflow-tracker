export type MediaQueryStub = Readonly<{ query: string; matches: boolean }>;

type ListenerArgs = Parameters<EventTarget['addEventListener']>;

const issued = new Set<FakeMediaQueryList>();

const matching = new Set<string>();

class FakeMediaQueryList extends EventTarget implements MediaQueryList {
  readonly media: string;
  readonly listeners = new Set<EventListenerOrEventListenerObject>();
  onchange = null;

  constructor(media: string) {
    super();
    this.media = media;
  }

  get matches(): boolean {
    return matching.has(this.media);
  }

  override addEventListener(...args: ListenerArgs): void {
    const [, listener] = args;
    if (listener) this.listeners.add(listener);
    super.addEventListener(...args);
  }

  override removeEventListener(...args: ListenerArgs): void {
    const [, listener] = args;
    if (listener) this.listeners.delete(listener);
    super.removeEventListener(...args);
  }

  addListener(): void {}

  removeListener(): void {}
}

function matchMedia(media: string): MediaQueryList {
  const list = new FakeMediaQueryList(media);
  issued.add(list);
  return list;
}

export function resetMediaQueries(): void {
  matching.clear();
  issued.clear();
  Object.defineProperty(window, 'matchMedia', { value: matchMedia, configurable: true });
}

export function stubMediaQuery({ query, matches }: MediaQueryStub): void {
  if (matches) matching.add(query);
  else matching.delete(query);
  for (const list of issued) if (list.media === query) list.dispatchEvent(new Event('change'));
}

export function mediaListenersOf(query: string): number {
  return [...issued]
    .filter((list) => list.media === query)
    .reduce((count, list) => count + list.listeners.size, 0);
}
