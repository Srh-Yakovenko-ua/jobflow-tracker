import { useState } from 'react';

export type Moving = Readonly<{ moving: boolean; start: () => void; end: () => void }>;

export function useMoving(): Moving {
  const [moving, setMoving] = useState(false);
  return {
    moving,
    start: () => {
      setMoving(true);
    },
    end: () => {
      setMoving(false);
    },
  };
}
