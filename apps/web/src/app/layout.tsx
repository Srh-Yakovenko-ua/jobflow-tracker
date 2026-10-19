import './globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { uk } from '../shared/i18n/uk';
import { onest, unbounded } from './fonts';

export const metadata: Metadata = {
  title: uk.app.title,
};

export type RootLayoutProps = Readonly<{ children: ReactNode }>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="uk" className={`${unbounded.variable} ${onest.variable}`}>
      <body>{children}</body>
    </html>
  );
}
