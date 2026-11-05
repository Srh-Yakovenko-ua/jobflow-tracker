import { useState } from 'react';

export function useLastPresent<T>(value: T | null): T | null {
  const [last, setLast] = useState(value);
  if (value !== null && value !== last) setLast(value);
  return value === null ? last : value;
}
