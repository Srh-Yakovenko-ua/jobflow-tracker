'use client';

import { useId, useState } from 'react';

import { cn } from '@/shared/lib/cn';

import { Button } from './button';
import { TOUCH_HEIGHT } from './touch-height';

export type Disclosure = Readonly<{
  shown: boolean;
  regionId: string;
  toggle: Readonly<{ 'aria-expanded': boolean; 'aria-controls': string; onClick: () => void }>;
}>;

export type DisclosureButtonProps = Readonly<{
  disclosure: Disclosure;
  labels: Readonly<{ show: string; hide: string }>;
}>;

export function useDisclosure(): Disclosure {
  const regionId = useId();
  const [shown, setShown] = useState(false);
  return {
    shown,
    regionId,
    toggle: {
      'aria-expanded': shown,
      'aria-controls': regionId,
      onClick: () => {
        setShown(!shown);
      },
    },
  };
}

export function DisclosureButton({ disclosure, labels }: DisclosureButtonProps) {
  return (
    <Button
      variant="ghost"
      size="xs"
      className={cn(TOUCH_HEIGHT, 'print:hidden')}
      {...disclosure.toggle}
    >
      {disclosure.shown ? labels.hide : labels.show}
    </Button>
  );
}
