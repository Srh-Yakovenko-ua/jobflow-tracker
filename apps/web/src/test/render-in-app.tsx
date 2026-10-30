import { render, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { Providers } from '@/app/providers';

export function InApp({ children }: Readonly<{ children: ReactNode }>) {
  return <Providers theme="light">{children}</Providers>;
}

export function renderInApp(ui: ReactNode) {
  render(<InApp>{ui}</InApp>);
  return userEvent.setup();
}

export function renderHookInApp<T>(hook: () => T) {
  return renderHook(hook, { wrapper: InApp });
}
