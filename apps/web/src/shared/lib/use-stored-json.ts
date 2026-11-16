'use client';

import { useState } from 'react';
import type { z } from 'zod';

import { readStoredJson, writeStoredJson } from './stored-json';

export type StoredJsonInput<Schema extends z.ZodType> = Readonly<{
  key: string | undefined;
  schema: Schema;
  fallback: z.output<Schema>;
}>;

type StoredRead<Value> = Readonly<{ key: string | undefined; value: Value }>;

export type StoredJson<Value> = Readonly<{
  value: Value;
  store: (update: (latest: Value) => Value) => void;
}>;

export function useStoredJson<Schema extends z.ZodType>({
  key,
  schema,
  fallback,
}: StoredJsonInput<Schema>): StoredJson<z.output<Schema>> {
  const [read, setRead] = useState<StoredRead<z.output<Schema>>>({
    key: undefined,
    value: fallback,
  });
  let current = read;
  if (read.key !== key) {
    current = {
      key,
      value: key === undefined ? fallback : (readStoredJson(key, schema) ?? fallback),
    };
    setRead(current);
  }
  return {
    value: current.value,
    store: (update) => {
      if (key === undefined) {
        setRead({ key, value: update(current.value) });
        return;
      }
      const value = update(readStoredJson(key, schema) ?? fallback);
      writeStoredJson(key, value);
      setRead({ key, value });
    },
  };
}
