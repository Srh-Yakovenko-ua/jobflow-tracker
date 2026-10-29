'use client';

import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import { Spinner } from './spinner';
import { Tooltip } from './tooltip';

const BASE =
  'touch-target inline-flex flex-none items-center justify-center gap-2 font-ui font-semibold whitespace-nowrap select-none transition-[background-color,color,box-shadow,translate] duration-(--duration-instant) ease-standard enabled:hover:-translate-y-px enabled:active:translate-y-0 disabled:cursor-not-allowed aria-busy:cursor-progress';

const VARIANTS = {
  primary: 'bg-accent text-surface shadow-accent enabled:hover:bg-accent-press',
  secondary: 'bg-surface-2 text-ink inset-ring inset-ring-line enabled:hover:bg-surface-3',
  ghost: 'bg-transparent text-accent-press enabled:hover:bg-accent-tint',
  danger: 'bg-danger/6 text-danger inset-ring inset-ring-danger/30 enabled:hover:bg-danger/10',
} as const;

const SIZES = {
  xs: { label: 'h-control-xs rounded-sm px-3.25 text-[12px]', icon: 'size-control-xs rounded-sm' },
  sm: { label: 'h-control-sm rounded-sm px-3.5 text-[12.5px]', icon: 'size-control-sm rounded-sm' },
  md: { label: 'h-control-md rounded-md px-4 text-[13.5px]', icon: 'size-control-md rounded-md' },
  lg: {
    label: 'h-control-lg rounded-[10px] px-5 text-[14.5px] enabled:hover:-translate-y-0.5',
    icon: 'size-control-lg rounded-[10px]',
  },
} as const;

const DISABLED = 'bg-surface-3 text-ink-3/60 shadow-none inset-ring inset-ring-line-soft';

const ICON_ONLY_TONE = 'text-ink-2';

export type ButtonVariant = keyof typeof VARIANTS;

export type ButtonSize = keyof typeof SIZES;

type ButtonLook = { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean };

type LabelButtonProps = ComponentProps<'button'> & ButtonLook & { icon?: ReactNode };

type IconButtonProps = Omit<ComponentProps<'button'>, 'children'> &
  ButtonLook & { icon: ReactNode; children?: never; 'aria-label': string };

export type ButtonProps = LabelButtonProps | IconButtonProps;

type ButtonShape = Required<Pick<ButtonLook, 'variant' | 'size'>> & {
  iconOnly: boolean;
  dimmed: boolean;
};

function buttonClasses({ variant, size, iconOnly, dimmed }: ButtonShape): string {
  return cn(
    BASE,
    VARIANTS[variant],
    iconOnly ? SIZES[size].icon : SIZES[size].label,
    iconOnly && variant === 'secondary' && ICON_ONLY_TONE,
    dimmed && DISABLED,
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const iconOnly = children === undefined;
  const button = (
    <button
      type="button"
      {...props}
      disabled={Boolean(disabled) || loading}
      aria-busy={loading || undefined}
      className={cn(
        buttonClasses({ variant, size, iconOnly, dimmed: Boolean(disabled) && !loading }),
        className,
      )}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
  const label = props['aria-label'];
  if (!iconOnly || label === undefined) return button;
  return <Tooltip content={label}>{button}</Tooltip>;
}
