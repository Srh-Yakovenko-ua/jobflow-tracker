import { useEffect, useState } from 'react';

export function useDebouncedValue<Value>(value: Value, delayMs: number): Value {
  const [debounced, setDebounced] = useState(value);
  if (value === undefined && debounced !== undefined) {
    setDebounced(value);
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);
  return debounced;
}
