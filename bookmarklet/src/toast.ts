import { copyOf } from './copy.js';
import { TOAST_STYLES } from './toast-styles.js';

export type ToastLink = { label: string; href: string };

export type ToastContent = {
  title: string;
  note?: string;
  link?: ToastLink;
  hideAfterMs?: number;
  busy?: true;
};

const HOST_TAG = 'jobflow-toast';
const BUSY = 'busy';
const SVG = 'http://www.w3.org/2000/svg';

function hostOf(): Element | null {
  return document.querySelector(HOST_TAG);
}

export function hideToast(): void {
  hostOf()?.remove();
}

export function toastIsBusy(): boolean {
  return hostOf()?.hasAttribute(BUSY) === true;
}

function mountRegion(): Element {
  hideToast();
  const host = document.createElement(HOST_TAG);
  const sheet = new CSSStyleSheet();
  const region = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  sheet.replaceSync(TOAST_STYLES);
  root.adoptedStyleSheets = [sheet];
  region.setAttribute('role', 'status');
  root.append(region);
  document.documentElement.append(host);
  return region;
}

function textElement<Tag extends 'p' | 'a'>(tag: Tag, text: string): HTMLElementTagNameMap[Tag] {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

function linkElement({ label, href }: ToastLink): HTMLAnchorElement {
  const link = textElement('a', label);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener';
  return link;
}

function closeButton(): HTMLButtonElement {
  const button = document.createElement('button');
  const icon = document.createElementNS(SVG, 'svg');
  const cross = document.createElementNS(SVG, 'path');
  cross.setAttribute('d', 'M18 6 6 18M6 6l12 12');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.append(cross);
  button.setAttribute('aria-label', copyOf('close'));
  button.append(icon);
  button.addEventListener('click', hideToast);
  return button;
}

function hideLater(shown: Element, hideAfterMs: number): void {
  setTimeout(() => {
    const host = hostOf();
    if (!host || !shown.isConnected) {
      return;
    }
    if (host.matches(':hover') || document.activeElement === host) {
      hideLater(shown, hideAfterMs);
      return;
    }
    host.remove();
  }, hideAfterMs);
}

export function showToast({ title, note, link, hideAfterMs, busy }: ToastContent): void {
  const region = hostOf()?.shadowRoot?.firstElementChild ?? mountRegion();
  const heading = textElement('p', title);
  const body = document.createElement('div');
  body.append(heading);
  if (note) {
    body.append(textElement('p', note));
  }
  if (link) {
    body.append(linkElement(link));
  }
  region.replaceChildren(body, closeButton());
  hostOf()?.toggleAttribute(BUSY, busy === true);
  if (hideAfterMs) {
    hideLater(heading, hideAfterMs);
  }
}
