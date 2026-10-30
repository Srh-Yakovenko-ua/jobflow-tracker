import type { ReactNode } from 'react';

import { PromisePanel } from './promise-panel';

export type AuthLayoutProps = Readonly<{ children: ReactNode }>;

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main id="main" className="grid min-h-dvh sm:grid-cols-2">
      <div className="flex flex-col justify-center bg-surface px-9 py-10">
        <div className="mx-auto w-full max-w-[490px]">{children}</div>
      </div>
      <PromisePanel />
    </main>
  );
}
