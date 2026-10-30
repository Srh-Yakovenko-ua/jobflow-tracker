import { OAUTH_PROVIDERS } from '@jobflow/shared';

import { config } from '@/shared/config';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { buttonLinkClasses } from '@/shared/ui/button';

const LINK_LOOK = cn(buttonLinkClasses({ variant: 'secondary', size: 'lg' }), 'bg-transparent');

export function OAuthLinks() {
  return (
    <div className="flex flex-col gap-2">
      {OAUTH_PROVIDERS.map((provider) => (
        <a
          key={provider}
          href={`${config.apiBaseUrl}/auth/oauth/${provider}/start`}
          className={LINK_LOOK}
        >
          {uk.auth.oauth[provider]}
        </a>
      ))}
    </div>
  );
}
