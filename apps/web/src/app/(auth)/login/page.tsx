import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';

export const metadata: Metadata = { title: uk.auth.login.title };

export default function LoginPage() {
  return <h1 className="font-display text-display">{uk.auth.login.title}</h1>;
}
