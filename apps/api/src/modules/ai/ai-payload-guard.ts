import { contactSchema, noteInputSchema } from '@jobflow/shared';
import { UnrecoverableError } from 'bullmq';

const CONTACT_CHANNELS = contactSchema.pick({ email: true, phone: true, telegram: true });

const PRIVATE_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  ...noteInputSchema.keyof().options,
  ...CONTACT_CHANNELS.keyof().options,
  'note',
  'notes',
  'contacts',
]);

export class AiPayloadError extends UnrecoverableError {
  constructor(readonly paths: readonly string[]) {
    super(`ai payload carries private fields at ${paths.join(', ')}`);
    this.name = 'AiPayloadError';
  }
}

const pathOf = (prefix: string, key: string) => (prefix === '' ? key : `${prefix}.${key}`);

function pathsUnder(value: unknown, prefix: string): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => pathsUnder(item, pathOf(prefix, String(index))));
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  return Object.entries(value).flatMap(([key, child]) => {
    const path = pathOf(prefix, key);
    return PRIVATE_PAYLOAD_KEYS.has(key) ? [path] : pathsUnder(child, path);
  });
}

export function privatePayloadPaths(input: unknown): string[] {
  return pathsUnder(input, '');
}
