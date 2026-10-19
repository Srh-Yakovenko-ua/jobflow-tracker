import type { Metadata } from 'next';

import { uk } from '@/shared/i18n';

export const metadata: Metadata = { title: uk.auth.register.title };

export default function RegisterPage() {
  return <h1 className="font-display text-display">{uk.auth.register.title}</h1>;
}
