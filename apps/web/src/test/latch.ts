export type Latch = {
  reached: Promise<void>;
  release: () => void;
};

export function latch(): Latch {
  let release = (): void => undefined;
  const reached = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { reached, release };
}
