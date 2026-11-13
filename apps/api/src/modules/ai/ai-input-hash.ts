import { createHash } from 'node:crypto';

import { AI_PROMPT_VERSIONS } from '@jobflow/shared';

import type { AiCompleteJob } from './ai.jobs.js';

export type AiHashedInput = Pick<AiCompleteJob, 'kind' | 'input'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function byKey([left]: [string, unknown], [right]: [string, unknown]): number {
  return left < right ? -1 : 1;
}

function canonical(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.normalize('NFC').trim().replace(/\s+/g, ' ');
  }
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).sort(byKey);
    return Object.fromEntries(entries.map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}

export type AiHashedJob = AiHashedInput & Pick<AiCompleteJob, 'aiJobId' | 'fresh'>;

function digest(parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

const keyOf = ({ kind, input }: AiHashedInput) => [
  kind,
  AI_PROMPT_VERSIONS[kind],
  canonical(input),
];

export function aiInputHash(hashed: AiHashedInput): string {
  return digest(keyOf(hashed));
}

export function jobInputHash({ aiJobId, fresh, ...hashed }: AiHashedJob): string {
  return fresh ? digest([...keyOf(hashed), aiJobId]) : aiInputHash(hashed);
}
