export type Latch = {
  reached: Promise<void>;
  release: () => void;
};

const heldLatches = new Set<Latch>();

export function latch(): Latch {
  let release = (): void => undefined;
  const reached = new Promise<void>((resolve) => {
    release = resolve;
  });
  const held = { reached, release };
  heldLatches.add(held);
  return held;
}

export function releaseHeldLatches(): void {
  heldLatches.forEach((held) => {
    held.release();
  });
  heldLatches.clear();
}
