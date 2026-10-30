import './globals.css';

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { THEME_COOKIE, themeFromCookie } from '@/shared/lib/theme';

import { onest, unbounded } from './fonts';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: uk.app.title, template: `%s · ${uk.app.brand}` },
};

export type RootLayoutProps = Readonly<{ children: ReactNode }>;

export default async function RootLayout({ children }: RootLayoutProps) {
  const theme = themeFromCookie((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="uk"
      data-theme={theme === 'system' ? undefined : theme}
      className={cn(unbounded.variable, onest.variable)}
    >
      <body>
        <Providers theme={theme}>{children}</Providers>
      </body>
    </html>
  );
}
