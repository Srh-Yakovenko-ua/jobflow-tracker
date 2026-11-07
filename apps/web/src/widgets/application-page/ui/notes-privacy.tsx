'use client';

import { Lock } from 'lucide-react';

import { uk } from '@/shared/i18n';
import { IconButton } from '@/shared/ui/icon-action';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

const COPY = uk.applicationPage.notes;

export function NotesPrivacy() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton label={COPY.privacyLabel} icon={Lock} />
      </PopoverTrigger>
      <PopoverContent aria-label={COPY.privacyLabel} className="max-w-60">
        <p className="text-body text-ink-2">{COPY.privacy}</p>
      </PopoverContent>
    </Popover>
  );
}
