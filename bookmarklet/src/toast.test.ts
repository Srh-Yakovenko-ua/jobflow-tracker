import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountPage, shownToast, toastHosts, toastLinkHref } from './test/page.js';
import { hideToast, showToast, toastIsBusy } from './toast.js';

const PAGE_HTML = '<h1>Senior React Developer</h1>';
const BOARD_LINK = { label: 'Відкрити дошку', href: 'http://localhost:3000/board' };

function pageStyleState() {
  return {
    head: document.head.innerHTML,
    body: document.body.innerHTML,
    styleSheets: document.styleSheets.length,
    adoptedStyleSheets: document.adoptedStyleSheets,
  };
}

describe('showToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mountPage({ html: PAGE_HTML });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds one host element and leaves the head, the body and the page sheets alone', () => {
    const before = pageStyleState();

    showToast({ title: 'Додано в JobFlow' });

    expect(toastHosts()).toHaveLength(1);
    expect(pageStyleState()).toEqual(before);
  });

  it('keeps its styles in a sheet adopted by the shadow root', () => {
    showToast({ title: 'Додано в JobFlow' });
    const [sheet, ...others] = shownToast().adoptedStyleSheets;

    expect(sheet).toBeInstanceOf(CSSStyleSheet);
    expect(sheet?.cssRules.length).toBeGreaterThan(0);
    expect(others).toEqual([]);
    expect(shownToast().querySelector('style')).toBeNull();
  });

  it('announces its text as a status', () => {
    showToast({ title: 'Додано в JobFlow', note: 'Етап: відмова' });

    expect(shownToast().querySelector('[role="status"]')?.textContent).toBe(
      'Додано в JobFlowЕтап: відмова',
    );
  });

  it('renders markup in a label as text', () => {
    showToast({
      title: '<img src=x onerror=alert(1)>',
      note: '<b>note</b>',
      link: { ...BOARD_LINK, label: '<i>label</i>' },
    });

    expect(shownToast().querySelector('img, b, i')).toBeNull();
    expect(shownToast().querySelector('p')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(shownToast().querySelector('a')?.textContent).toBe('<i>label</i>');
  });

  it('opens its link in a new tab without an opener', () => {
    showToast({ title: 'Не додано', link: BOARD_LINK });
    const link = shownToast().querySelector('a');

    expect(toastLinkHref()).toBe('http://localhost:3000/board');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toBe('noopener');
  });

  it('reuses the host for the next message', () => {
    showToast({ title: 'Додаємо в JobFlow', link: BOARD_LINK });
    showToast({ title: 'Не вдалося додати' });

    expect(toastHosts()).toHaveLength(1);
    expect(shownToast().textContent).toBe('Не вдалося додати');
  });

  it('leaves the page when its close button is pressed', () => {
    showToast({ title: 'Не вдалося додати' });

    shownToast().querySelector<HTMLButtonElement>('button[aria-label="Закрити"]')?.click();

    expect(toastHosts()).toHaveLength(0);
  });

  it('is busy only while a busy message is shown', () => {
    expect(toastIsBusy()).toBe(false);

    showToast({ title: 'Додаємо в JobFlow', busy: true });
    expect(toastIsBusy()).toBe(true);

    showToast({ title: 'Додано в JobFlow' });
    expect(toastIsBusy()).toBe(false);
  });

  it('hides itself after the given time', () => {
    showToast({ title: 'Додано в JobFlow', hideAfterMs: 8000 });

    vi.advanceTimersByTime(7999);
    expect(toastHosts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(toastHosts()).toHaveLength(0);
  });

  it('keeps a newer message when the timer of an older one fires', () => {
    showToast({ title: 'Додано в JobFlow', hideAfterMs: 8000 });
    vi.advanceTimersByTime(5000);
    showToast({ title: 'Не вдалося додати' });

    vi.advanceTimersByTime(5000);

    expect(shownToast().textContent).toBe('Не вдалося додати');
  });

  it('waits while the keyboard focus is inside it', () => {
    showToast({ title: 'Додано в JobFlow', link: BOARD_LINK, hideAfterMs: 8000 });
    const link = shownToast().querySelector('a');

    link?.focus();
    vi.advanceTimersByTime(8000);
    expect(toastHosts()).toHaveLength(1);

    link?.blur();
    vi.advanceTimersByTime(8000);
    expect(toastHosts()).toHaveLength(0);
  });
});

describe('hideToast', () => {
  it('removes the host and does nothing when no toast is shown', () => {
    mountPage({ html: PAGE_HTML });
    showToast({ title: 'Додаємо в JobFlow', busy: true });

    hideToast();
    hideToast();

    expect(toastHosts()).toHaveLength(0);
    expect(toastIsBusy()).toBe(false);
  });
});
