import { AUTH_ROUTES } from '@jobflow/shared';
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect(AUTH_ROUTES.home);
}
