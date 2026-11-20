'use client';

import type { BoardCard } from '@jobflow/shared';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { fetchApplicationAi, jobWaiting } from '@/entities/application';
import { apiStatusOf, HTTP_STATUS } from '@/shared/api';

import { generateFollowup } from '../api/generate-followup';
import { invalidateFollowup } from './invalidate-followup';

export type BulkRowState = 'queued' | 'sent' | 'failed' | 'manual';

export type BulkRow = Readonly<{ card: BoardCard; state: BulkRowState }>;

export type BulkFollowups = Readonly<{
  rows: readonly BulkRow[];
  running: boolean;
  start: (cards: readonly BoardCard[]) => void;
  skip: (applicationId: BoardCard['id']) => void;
}>;

type MarkRows = (ids: readonly BoardCard['id'][], state: BulkRowState) => void;

type QueueRun = Readonly<{
  queryClient: QueryClient;
  ids: readonly BoardCard['id'][];
  skipped: ReadonlySet<BoardCard['id']>;
  mark: MarkRows;
  signal: AbortSignal;
}>;

type DraftRequest = Pick<QueueRun, 'queryClient' | 'signal'> &
  Readonly<{ applicationId: BoardCard['id'] }>;

function isRateLimited(error: unknown): boolean {
  return apiStatusOf(error) === HTTP_STATUS.tooManyRequests;
}

async function requestDraft({ queryClient, signal, applicationId }: DraftRequest) {
  const { language, draft, job } = await fetchApplicationAi(
    { id: applicationId, segment: 'followup' },
    signal,
  );
  signal.throwIfAborted();
  if (draft !== null || jobWaiting(job)) return;
  await generateFollowup({
    applicationId,
    body: { tone: 'neutral', language, variant: false },
    idempotencyKey: crypto.randomUUID(),
  });
  await invalidateFollowup({ queryClient, applicationId });
}

async function runQueue({ ids, skipped, mark, ...request }: QueueRun): Promise<void> {
  for (const [index, applicationId] of ids.entries()) {
    if (request.signal.aborted) return;
    if (skipped.has(applicationId)) continue;
    try {
      await requestDraft({ ...request, applicationId });
      mark([applicationId], 'sent');
    } catch (error) {
      if (!isRateLimited(error)) {
        mark([applicationId], 'failed');
        continue;
      }
      mark(ids.slice(index), 'manual');
      return;
    }
  }
}

function useLifetimeSignal() {
  const lifetimeRef = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    lifetimeRef.current = controller;
    return () => {
      controller.abort();
    };
  }, []);
  return lifetimeRef;
}

export function useBulkFollowups(): BulkFollowups {
  const queryClient = useQueryClient();
  const lifetimeRef = useLifetimeSignal();
  const [rows, setRows] = useState<readonly BulkRow[]>([]);
  const skippedRef = useRef(new Set<BoardCard['id']>());
  const mark: MarkRows = (ids, state) => {
    setRows((current) =>
      current.map((row) => (ids.includes(row.card.id) ? { ...row, state } : row)),
    );
  };
  return {
    rows,
    running: rows.some((row) => row.state === 'queued'),
    start: (cards) => {
      skippedRef.current = new Set();
      setRows(cards.map((card) => ({ card, state: 'queued' })));
      const ids = cards.map((card) => card.id);
      const { signal } = lifetimeRef.current;
      void runQueue({ queryClient, ids, skipped: skippedRef.current, mark, signal });
    },
    skip: (applicationId) => {
      skippedRef.current.add(applicationId);
      setRows((current) => current.filter((row) => row.card.id !== applicationId));
    },
  };
}
