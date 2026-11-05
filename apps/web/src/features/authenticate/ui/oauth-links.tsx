'use client';

import { useQuery } from '@tanstack/react-query';

import { config } from '@/shared/config';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { buttonLinkClasses } from '@/shared/ui/button';
import { Reveal } from '@/shared/ui/reveal';

import { oauthProvidersQueryOptions } from '../api/oauth-providers';

const LINK_LOOK = cn(buttonLinkClasses({ variant: 'secondary', size: 'lg' }), 'bg-transparent');

const COPY = uk.auth;

function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="h-px flex-1 bg-line-soft" />
      <span className="eyebrow text-ink-3">{COPY.or}</span>
      <span aria-hidden className="h-px flex-1 bg-line-soft" />
    </div>
  );
}

export function OAuthLinks() {
  const { data } = useQuery(oauthProvidersQueryOptions());
  const providers = data?.items ?? [];
  return (
    <Reveal shown={providers.length > 0} className="-mt-5.5">
      <div className="flex flex-col gap-5.5 pt-5.5">
        <OrDivider />
        <div className="flex flex-col gap-2">
          {providers.map((provider) => (
            <a
              key={provider}
              href={`${config.apiBaseUrl}/auth/oauth/${provider}/start`}
              className={LINK_LOOK}
            >
              {COPY.oauth[provider]}
            </a>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
