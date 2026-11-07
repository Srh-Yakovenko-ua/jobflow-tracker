import { render, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { Providers } from '@/app/providers';

export function InApp({ children }: Readonly<{ children: ReactNode }>) {
  return <Providers theme="light">{children}</Providers>;
}

export function renderViewInApp(ui: ReactNode) {
  const view = render(ui, { wrapper: InApp });
  return { user: userEvent.setup(), view };
}

export function renderInApp(ui: ReactNode) {
  return renderViewInApp(ui).user;
}

export function renderHookInApp<T>(hook: () => T) {
  return renderHook(hook, { wrapper: InApp });
}
