import type { Metadata } from 'next';

import { AuthForm } from '@/features/authenticate';
import { uk } from '@/shared/i18n';

export const metadata: Metadata = { title: uk.auth.login.title };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { oauth } = await searchParams;
  return <AuthForm mode="login" notice={oauth === 'denied' ? 'oauthDenied' : undefined} />;
}
