export type Listeners = Readonly<{
  subscribe: (listener: () => void) => () => void;
  notify: () => void;
}>;

export function createListeners(): Listeners {
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    notify: () => {
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}
