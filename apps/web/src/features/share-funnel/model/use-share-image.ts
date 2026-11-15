'use client';

import { useEffect, useState } from 'react';

import { drawShareCard } from '../lib/draw-share-card';
import { type ShareCardSceneInput, shareCardSceneOf } from '../lib/share-card-scene';

export type ShareImage =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; blob: Blob; url: string }>
  | Readonly<{ status: 'failed' }>;

type DrawnImage = Readonly<{ variant: string; image: ShareImage }>;

const LOADING: ShareImage = { status: 'loading' };

const FAILED: ShareImage = { status: 'failed' };

export function useShareImage({ story, scheme, hideNumbers }: ShareCardSceneInput) {
  const { kpis, graph, headline } = story;
  const [attempt, setAttempt] = useState(0);
  const [drawn, setDrawn] = useState<DrawnImage>();
  const variant = `${scheme}:${String(hideNumbers)}:${String(attempt)}`;
  useEffect(() => {
    const abort = new AbortController();
    const made = { url: '' };
    const scene = shareCardSceneOf({ story: { kpis, graph, headline }, scheme, hideNumbers });
    drawShareCard(scene, abort.signal).then(
      (blob) => {
        if (abort.signal.aborted) return;
        made.url = URL.createObjectURL(blob);
        setDrawn({ variant, image: { status: 'ready', blob, url: made.url } });
      },
      () => {
        if (!abort.signal.aborted) setDrawn({ variant, image: FAILED });
      },
    );
    return () => {
      abort.abort();
      if (made.url !== '') URL.revokeObjectURL(made.url);
    };
  }, [kpis, graph, headline, scheme, hideNumbers, variant]);
  return {
    image: drawn?.variant === variant ? drawn.image : LOADING,
    retry: () => {
      setAttempt((count) => count + 1);
    },
  };
}
