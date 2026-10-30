'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { ICON_ACTION } from './field-surface';
import { Input, type InputProps } from './input';

export type PasswordInputProps = Omit<InputProps, 'type' | 'adornments'>;

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  const toggle = (
    <button
      type="button"
      aria-label={uk.ui.showPassword}
      aria-pressed={visible}
      onClick={() => {
        setVisible((shown) => !shown);
      }}
      className={cn(ICON_ACTION, '-me-1.5 size-7 active:bg-surface-3 active:text-ink')}
    >
      <Icon aria-hidden />
    </button>
  );
  return <Input {...props} type={visible ? 'text' : 'password'} adornments={{ end: toggle }} />;
}
