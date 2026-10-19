import type { ReactNode } from 'react';

export type ProductLayoutProps = Readonly<{ children: ReactNode }>;

export default function ProductLayout({ children }: ProductLayoutProps) {
  return <main id="main">{children}</main>;
}
