import { createContext, type ReactNode, use, useState } from 'react';
import { type StoreApi, useStore } from 'zustand';

export type StoreProviderProps<Initial> = Readonly<{ initial: Initial; children: ReactNode }>;

export type StoreContextInput<Initial, Store> = Readonly<{
  name: string;
  create: (initial: Initial) => StoreApi<Store>;
}>;

export function createStoreContext<Initial, Store>({
  name,
  create,
}: StoreContextInput<Initial, Store>) {
  const StoreContext = createContext<StoreApi<Store> | null>(null);

  function Provider({ initial, children }: StoreProviderProps<Initial>) {
    const [store] = useState(() => create(initial));
    return <StoreContext value={store}>{children}</StoreContext>;
  }

  function useStoreSelector<Picked>(selector: (store: Store) => Picked): Picked {
    const store = use(StoreContext);
    if (!store) {
      throw new Error(`use${name} must be used inside ${name}Provider`);
    }
    return useStore(store, selector);
  }

  return { Provider, useStoreSelector };
}
