import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { createStoreContext } from './store-context';

type CounterState = { count: number };
type CounterStore = CounterState & { increment: () => void };

function createCounterStore(initial: CounterState) {
  return createStore<CounterStore>()((set, get) => ({
    ...initial,
    increment: () => {
      set({ count: get().count + 1 });
    },
  }));
}

const { Provider: CounterProvider, useStoreSelector: useCounter } = createStoreContext({
  name: 'CounterStore',
  create: createCounterStore,
});

function countOf(store: CounterStore): number {
  return store.count;
}

function useCount(): number {
  return useCounter(countOf);
}

function Counter() {
  const count = useCount();
  const increment = useCounter((store) => store.increment);
  return (
    <button type="button" onClick={increment}>
      {count}
    </button>
  );
}

describe('createStoreContext', () => {
  it('seeds each provider with its own initial state and follows its updates', async () => {
    render(
      <>
        <CounterProvider initial={{ count: 2 }}>
          <Counter />
        </CounterProvider>
        <CounterProvider initial={{ count: 5 }}>
          <Counter />
        </CounterProvider>
      </>,
    );

    await userEvent.click(screen.getByRole('button', { name: '2' }));

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['3', '5']);
  });

  it('keeps its store when the provider re-renders with another initial state', async () => {
    const { rerender } = render(
      <CounterProvider initial={{ count: 2 }}>
        <Counter />
      </CounterProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: '2' }));

    rerender(
      <CounterProvider initial={{ count: 9 }}>
        <Counter />
      </CounterProvider>,
    );

    expect(screen.getByRole('button').textContent).toBe('3');
  });

  it('refuses a read outside its provider and names the provider', () => {
    expect(() => renderHook(useCount)).toThrow(
      'useCounterStore must be used inside CounterStoreProvider',
    );
  });
});
