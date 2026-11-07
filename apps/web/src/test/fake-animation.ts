import { vi } from 'vitest';

export function fakeAnimation({ running }: Readonly<{ running: boolean }>) {
  let end: () => void = () => undefined;
  const playState: AnimationPlayState = running ? 'running' : 'finished';
  const animation = {
    playState,
    finished: running
      ? new Promise<void>((resolve) => {
          end = () => {
            resolve();
          };
        })
      : Promise.resolve(),
    finish: vi.fn(() => {
      animation.playState = 'finished';
      end();
    }),
  };
  return animation;
}
