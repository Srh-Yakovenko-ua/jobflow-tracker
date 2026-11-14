export const PRIVATE_PAYLOAD_KEYS = [
  'body',
  'note',
  'notes',
  'contacts',
  'email',
  'phone',
  'telegram',
];

export function keysDeep(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(keysDeep);
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  return Object.entries(value).flatMap(([key, child]) => [key, ...keysDeep(child)]);
}
