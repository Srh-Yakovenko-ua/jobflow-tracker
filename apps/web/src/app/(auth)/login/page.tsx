import type { Metadata } from 'next';

import { AuthForm, authNoticeOf } from '@/features/authenticate';
import { uk } from '@/shared/i18n';
import { AUTH_ROUTES, safeReturnTo } from '@/shared/lib/return-to';

export const metadata: Metadata = { title: uk.auth.login.title };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { oauth, provider, [AUTH_ROUTES.returnParam]: requested } = await searchParams;
  return (
    <AuthForm
      mode="login"
      notice={authNoticeOf({ oauth, provider })}
      returnTo={safeReturnTo(requested)}
    />
  );
}
