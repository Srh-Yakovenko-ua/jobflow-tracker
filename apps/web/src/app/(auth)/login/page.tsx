import type { Metadata } from 'next';

import { AuthForm } from '@/features/authenticate';
import { uk } from '@/shared/i18n';
import { AUTH_ROUTES, safeReturnTo } from '@/shared/lib/return-to';

export const metadata: Metadata = { title: uk.auth.login.title };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { oauth, [AUTH_ROUTES.returnParam]: requested } = await searchParams;
  return (
    <AuthForm
      mode="login"
      notice={oauth === 'denied' ? 'oauthDenied' : undefined}
      returnTo={safeReturnTo(requested)}
    />
  );
}
