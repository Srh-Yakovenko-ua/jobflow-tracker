import { type OAuthProvider, oauthProviderSchema } from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import type { BannerContent } from '@/shared/ui/banner';

export type AuthNotice =
  { kind: 'oauthDenied' } | { kind: 'oauthUnavailable'; provider: OAuthProvider };

export type AuthNoticeQuery = Readonly<{ oauth: unknown; provider: unknown }>;

const COPY = uk.auth.alerts;

export function authNoticeOf({ oauth, provider }: AuthNoticeQuery): AuthNotice | undefined {
  if (oauth === 'denied') return { kind: 'oauthDenied' };
  const parsed = oauthProviderSchema.safeParse(provider);
  if (oauth !== 'unavailable' || !parsed.success) return undefined;
  return { kind: 'oauthUnavailable', provider: parsed.data };
}

export function noticeCopyOf(notice: AuthNotice): BannerContent {
  return notice.kind === 'oauthDenied' ? COPY.oauthDenied : COPY.oauthUnavailable[notice.provider];
}
