import type { CapturePasteResponse, ErrorResponse, PossibleDuplicate } from '@jobflow/shared';
import { vi } from 'vitest';

import type { BookmarkletConfig } from '../href.js';

export const CONFIG: BookmarkletConfig = {
  token: `${'k7_'.repeat(14)}Q`,
  apiUrl: 'http://localhost:4000',
  webUrl: 'http://localhost:3000',
};

export const ADDED_BODY: CapturePasteResponse = {
  applicationId: '6f1c2b1e-5a0d-4c5e-9b7a-2f4d8e1a3c10',
  jobId: '0b9d7c3a-1e2f-4a6b-8c5d-7e9f1a2b3c4d',
  possibleDuplicates: [],
};

export const DUPLICATE: PossibleDuplicate = {
  id: 'c2a1f0e9-3b4d-4e6f-a1b2-9d8c7e6f5a4b',
  company: 'Acme Software',
  position: 'Senior React Developer',
  appliedAt: '2026-10-18T09:00:00.000Z',
  stage: 'rejected',
};

export type FetchReply = { status: number; body?: unknown; headers?: Record<string, string> };

export type FetchBehaviour = FetchReply | Error | 'silent';

export function conflictReply(type: ErrorResponse['type']): FetchReply {
  const body: ErrorResponse = { type, title: 'Conflict', status: 409, requestId: 'req-1' };
  return { status: 409, body };
}

function replyTo(behaviour: FetchBehaviour) {
  if (behaviour === 'silent') {
    return new Promise<never>(() => undefined);
  }
  if (behaviour instanceof Error) {
    return Promise.reject(behaviour);
  }
  const { status, body = {}, headers = {} } = behaviour;
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers }));
}

export function stubFetch(behaviour: FetchBehaviour) {
  const fetchStub = vi.fn(async (_url: string, init: RequestInit) => {
    init.signal?.throwIfAborted();
    return replyTo(behaviour);
  });
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
}
