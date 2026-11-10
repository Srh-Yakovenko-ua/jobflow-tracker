import type {
  CaptureBookmarkletInput,
  CapturePasteResponse,
  PossibleDuplicate,
} from '@jobflow/shared';

import { pageTextOf } from './extract.js';
import type { BookmarkletConfig } from './href.js';
import { SHARED } from './shared-data.js';

export type DuplicateHint = Pick<PossibleDuplicate, 'stage' | 'appliedAt'>;

export type CaptureOutcome =
  | {
      kind: 'added';
      applicationId: CapturePasteResponse['applicationId'];
      duplicate?: DuplicateHint;
    }
  | { kind: 'rateLimited'; retryAfterSeconds: number }
  | { kind: 'unauthorized' | 'conflict' | 'repeated' | 'failed' | 'unreachable' };

export type CaptureRequest = {
  config: BookmarkletConfig;
  payload: CaptureBookmarkletInput;
  date: Date;
};

const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_RETRY_SECONDS = 60;
export const FAILED: CaptureOutcome = { kind: 'failed' };
const REFUSALS: Record<number, CaptureOutcome> = {
  401: { kind: 'unauthorized' },
  409: { kind: 'conflict' },
};

function cleanText(text: string, maxLength: number): string {
  return text.replaceAll('\u0000', '').trim().slice(0, maxLength);
}

export function payloadOf(page: Document): CaptureBookmarkletInput {
  return {
    url: page.location.href,
    title: cleanText(page.title, SHARED.titleMaxLength) || page.location.hostname,
    text: cleanText(pageTextOf(page), SHARED.textMaxLength),
  };
}

function fnv1aHexOf(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function idempotencyKeyOf({ url, date }: { url: string; date: Date }): string {
  return `bm-${date.toISOString().slice(0, 10)}-${fnv1aHexOf(url)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDuplicateHint(value: unknown): value is DuplicateHint {
  return (
    isRecord(value) &&
    typeof value.stage === 'string' &&
    Object.hasOwn(SHARED.stageLabels, value.stage) &&
    (value.appliedAt === null || typeof value.appliedAt === 'string')
  );
}

function addedOf(body: unknown): CaptureOutcome {
  if (
    !isRecord(body) ||
    typeof body.applicationId !== 'string' ||
    !Array.isArray(body.possibleDuplicates)
  ) {
    return FAILED;
  }
  const added = { kind: 'added', applicationId: body.applicationId } as const;
  const duplicate: unknown = body.possibleDuplicates[0];
  if (duplicate === undefined) {
    return added;
  }
  return isDuplicateHint(duplicate) ? { ...added, duplicate } : FAILED;
}

async function outcomeOf(response: Response): Promise<CaptureOutcome> {
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) {
    return addedOf(body);
  }
  if (response.status === 429) {
    const seconds = Number(response.headers.get('Retry-After'));
    const retryAfterSeconds = seconds > 0 && seconds < Infinity ? seconds : DEFAULT_RETRY_SECONDS;
    return { kind: 'rateLimited', retryAfterSeconds };
  }
  if (response.status === 409 && isRecord(body) && body.type === 'idempotency_conflict') {
    return { kind: 'repeated' };
  }
  return REFUSALS[response.status] ?? FAILED;
}

export async function sendCapture({
  config,
  payload,
  date,
}: CaptureRequest): Promise<CaptureOutcome> {
  try {
    const response = await fetch(`${config.apiUrl}/api/v1/capture/bookmarklet`, {
      method: 'POST',
      headers: {
        Authorization: `Capture ${config.token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKeyOf({ url: payload.url, date }),
      },
      body: JSON.stringify(payload),
      credentials: 'omit',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return await outcomeOf(response);
  } catch {
    return { kind: 'unreachable' };
  }
}
