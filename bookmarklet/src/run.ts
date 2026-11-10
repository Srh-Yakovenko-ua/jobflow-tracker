import { type CaptureOutcome, payloadOf, sendCapture } from './capture.js';
import { copyOf, duplicateMessageOf, retryMessageOf } from './copy.js';
import type { CopyKey } from './copy-uk.js';
import { addUrlOf, openFallback } from './fallback.js';
import type { BookmarkletConfig } from './href.js';
import { hideToast, showToast, type ToastContent, toastIsBusy } from './toast.js';

type OutcomeContext = { webUrl: string; addUrl: string; now: Date };

type Added = Extract<CaptureOutcome, { kind: 'added' }>;

type Refusal = Exclude<CaptureOutcome['kind'], 'added' | 'rateLimited'>;

type RefusalToast = { title: CopyKey; label: CopyKey; path?: string };

const SUCCESS_HIDE_MS = 8000;

const ADD_BY_HAND: RefusalToast = { title: 'failed', label: 'addByHand' };

const REFUSAL_TOASTS: Record<Refusal, RefusalToast> = {
  unauthorized: { title: 'unauthorized', label: 'newBookmarklet', path: '/settings' },
  conflict: { title: 'conflict', label: 'openBoard', path: '/board' },
  failed: ADD_BY_HAND,
  unreachable: ADD_BY_HAND,
};

function addedToastOf({ applicationId, duplicate }: Added, { webUrl, now }: OutcomeContext) {
  const href = new URL(`/applications/${encodeURIComponent(applicationId)}`, webUrl).href;
  const toast = { title: copyOf('added'), link: { label: copyOf('openCard'), href } };
  return duplicate
    ? { ...toast, note: duplicateMessageOf(duplicate, now) }
    : { ...toast, hideAfterMs: SUCCESS_HIDE_MS };
}

function toastOf(outcome: CaptureOutcome, context: OutcomeContext): ToastContent {
  if (outcome.kind === 'added') {
    return addedToastOf(outcome, context);
  }
  if (outcome.kind === 'rateLimited') {
    return { title: retryMessageOf(outcome.retryAfterSeconds) };
  }
  const { title, label, path } = REFUSAL_TOASTS[outcome.kind];
  const href = path ? new URL(path, context.webUrl).href : context.addUrl;
  return { title: copyOf(title), link: { label: copyOf(label), href } };
}

export async function run(config: BookmarkletConfig): Promise<void> {
  if (toastIsBusy()) {
    return;
  }
  const { webUrl } = config;
  const now = new Date();
  const payload = payloadOf(document);
  const addUrl = addUrlOf({ webUrl, payload });
  showToast({ title: copyOf('sending'), busy: true });
  const outcome = await sendCapture({ config, payload, date: now });
  if (outcome.kind === 'unreachable' && openFallback(addUrl)) {
    hideToast();
    return;
  }
  showToast(toastOf(outcome, { webUrl, addUrl, now }));
}
