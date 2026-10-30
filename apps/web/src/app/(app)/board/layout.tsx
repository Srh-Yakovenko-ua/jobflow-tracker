import type { ReactNode } from 'react';

type BoardLayoutProps = Readonly<{ children: ReactNode; sheet: ReactNode }>;

export default function BoardLayout({ children, sheet }: BoardLayoutProps) {
  return (
    <>
      {children}
      {sheet}
    </>
  );
}
