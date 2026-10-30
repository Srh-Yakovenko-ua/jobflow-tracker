import type { Metadata } from 'next';

import { AuthForm } from '@/features/authenticate';
import { uk } from '@/shared/i18n';

export const metadata: Metadata = { title: uk.auth.register.title };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
