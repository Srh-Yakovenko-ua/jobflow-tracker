export type MotionPreference = 'reduce' | 'no-preference';

const REDUCE_QUERIES = new Set(['(prefers-reduced-motion: reduce)', '(prefers-reduced-motion)']);

const issued = new Set<FakeMediaQueryList>();

let preference: MotionPreference = 'no-preference';

class FakeMediaQueryList extends EventTarget implements MediaQueryList {
  readonly media: string;
  onchange = null;

  constructor(media: string) {
    super();
    this.media = media;
  }

  get matches(): boolean {
    return preference === 'reduce' && REDUCE_QUERIES.has(this.media);
  }

  addListener(): void {}

  removeListener(): void {}
}

function matchMedia(media: string): MediaQueryList {
  const list = new FakeMediaQueryList(media);
  issued.add(list);
  return list;
}

export function stubMotionPreference(next: MotionPreference): void {
  preference = next;
  Object.defineProperty(window, 'matchMedia', { value: matchMedia, configurable: true });
  for (const list of issued) list.dispatchEvent(new Event('change'));
}
