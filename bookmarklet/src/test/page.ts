const TOAST_TAG = 'jobflow-toast';

const BLOCK_TAGS = new Set([
  'ARTICLE',
  'ASIDE',
  'DIV',
  'FOOTER',
  'H1',
  'HEADER',
  'LI',
  'MAIN',
  'NAV',
  'P',
  'SECTION',
  'UL',
]);

function renderedTextOf(node: Node): string {
  if (!(node instanceof HTMLElement)) {
    return (node.textContent ?? '').replace(/\s+/g, ' ');
  }
  const text = Array.from(node.childNodes, renderedTextOf).join('');
  return BLOCK_TAGS.has(node.tagName) ? `\n${text}\n` : text;
}

Object.defineProperty(HTMLElement.prototype, 'innerText', {
  configurable: true,
  get(this: HTMLElement) {
    return renderedTextOf(this)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n');
  },
});

export type PageFixture = { html: string; title?: string; path?: string };

export function mountPage({ html, title = '', path = '/' }: PageFixture): void {
  document.querySelector(TOAST_TAG)?.remove();
  document.getSelection()?.removeAllRanges();
  history.replaceState(null, '', path);
  document.title = title;
  document.body.innerHTML = html;
}

export function elementOf(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`No element matches ${selector}`);
  }
  return element;
}

export function selectText(selector: string): void {
  const range = document.createRange();
  range.selectNodeContents(elementOf(selector));
  document.getSelection()?.addRange(range);
}

export function toastHosts(): NodeListOf<Element> {
  return document.querySelectorAll(TOAST_TAG);
}

export function shownToast(): ShadowRoot {
  const root = document.querySelector(TOAST_TAG)?.shadowRoot;
  if (!root) {
    throw new Error('No toast is shown');
  }
  return root;
}

export function toastLinkHref(): string | undefined {
  return shownToast().querySelector('a')?.href;
}
