'use client';

import { useRef } from 'react';

type SubmitKey = Readonly<{ keyFor: (body: unknown) => string; reset: () => void }>;

type KeyedSubmit = Readonly<{ json: string; key: string }>;

export function useSubmitKey(): SubmitKey {
  const lastRef = useRef<KeyedSubmit | null>(null);
  return {
    keyFor: (body) => {
      const json = JSON.stringify(body);
      const last = lastRef.current;
      if (last?.json === json) return last.key;
      const key = crypto.randomUUID();
      lastRef.current = { json, key };
      return key;
    },
    reset: () => {
      lastRef.current = null;
    },
  };
}
