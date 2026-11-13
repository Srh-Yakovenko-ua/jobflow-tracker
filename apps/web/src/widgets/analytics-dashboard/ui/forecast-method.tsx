'use client';

import { Info } from 'lucide-react';

import { uk } from '@/shared/i18n';
import { IconButton } from '@/shared/ui/icon-action';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

const COPY = uk.analytics.blocks.forecast.method;

export function ForecastMethod() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton label={COPY.label} icon={Info} />
      </PopoverTrigger>
      <PopoverContent
        aria-label={COPY.label}
        align="end"
        className="flex w-73 max-w-[calc(100vw-16px)] origin-(--radix-popover-content-transform-origin) flex-col gap-2"
      >
        <h3 className="text-[13.5px] leading-[1.4] font-semibold text-ink">{COPY.title}</h3>
        {COPY.body.map((paragraph) => (
          <p key={paragraph} className="text-[12.5px] leading-[1.55] text-pretty text-ink-2">
            {paragraph}
          </p>
        ))}
      </PopoverContent>
    </Popover>
  );
}
