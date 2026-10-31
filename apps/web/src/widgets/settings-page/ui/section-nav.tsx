'use client';

import { useSyncExternalStore } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { SETTINGS_SECTIONS } from '../model/settings-items';

const LINK =
  'touch-target flex h-10.5 items-center rounded-[9px] px-3 text-[14.5px] whitespace-nowrap transition-colors duration-(--duration-fast) ease-standard';

const ACTIVE = 'bg-line-soft font-semibold text-ink';

const IDLE = 'text-ink-3 hover:bg-surface-3 hover:text-ink';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
}

const hashOf = () => window.location.hash.slice(1);

const noHash = () => '';

export function SectionNav() {
  const hash = useSyncExternalStore(subscribe, hashOf, noHash);
  const active = SETTINGS_SECTIONS.find((section) => section === hash) ?? SETTINGS_SECTIONS[0];
  return (
    <nav aria-label={uk.settings.navLabel} className="md:sticky md:top-24">
      <ul className="flex flex-wrap gap-0.5 md:flex-col">
        {SETTINGS_SECTIONS.map((section) => (
          <li key={section}>
            <a
              href={`#${section}`}
              aria-current={section === active ? 'location' : undefined}
              className={cn(LINK, TOUCH_HEIGHT, section === active ? ACTIVE : IDLE)}
            >
              {uk.settings.sections[section]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
