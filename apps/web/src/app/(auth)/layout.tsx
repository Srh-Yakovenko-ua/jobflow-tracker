import type { ReactNode } from 'react';

export type AuthLayoutProps = Readonly<{ children: ReactNode }>;

export default function AuthLayout({ children }: AuthLayoutProps) {
  return <main id="main">{children}</main>;
}
