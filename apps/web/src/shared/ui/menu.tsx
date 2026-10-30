'use client';

import { Check } from 'lucide-react';
import { DropdownMenu as MenuPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

import { MENU_ITEM, MENU_LABEL, MENU_SURFACE } from './field-surface';
import { TOUCH_HEIGHT } from './touch-height';

const ITEM = cn(MENU_ITEM, TOUCH_HEIGHT);

export const Menu = MenuPrimitive.Root;

export const MenuTrigger = MenuPrimitive.Trigger;

export const MenuRadioGroup = MenuPrimitive.RadioGroup;

export type MenuContentProps = ComponentProps<typeof MenuPrimitive.Content>;

export function MenuContent({ className, ...props }: MenuContentProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        align="end"
        sideOffset={8}
        collisionPadding={8}
        {...props}
        className={cn(MENU_SURFACE, 'w-63 max-w-[calc(100vw-16px)]', className)}
      />
    </MenuPrimitive.Portal>
  );
}

export type MenuItemProps = ComponentProps<typeof MenuPrimitive.Item>;

export function MenuItem({ className, ...props }: MenuItemProps) {
  return (
    <MenuPrimitive.Item
      data-focus="option"
      {...props}
      className={cn(ITEM, 'gap-2.5 [&_svg]:flex-none [&_svg]:text-ink-3', className)}
    />
  );
}

export type MenuLabelProps = ComponentProps<typeof MenuPrimitive.Label>;

export function MenuLabel({ className, ...props }: MenuLabelProps) {
  return <MenuPrimitive.Label {...props} className={cn(MENU_LABEL, className)} />;
}

export function MenuSeparator() {
  return <MenuPrimitive.Separator className="mx-1.5 my-1 h-px bg-line-soft" />;
}

export type MenuRadioItemProps = ComponentProps<typeof MenuPrimitive.RadioItem>;

export function MenuRadioItem({ className, children, ...props }: MenuRadioItemProps) {
  return (
    <MenuPrimitive.RadioItem
      data-focus="option"
      {...props}
      className={cn(ITEM, 'data-[state=checked]:font-semibold', className)}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <span aria-hidden className="flex w-3.75 flex-none justify-center text-accent-press">
        <MenuPrimitive.ItemIndicator>
          <Check size={14} />
        </MenuPrimitive.ItemIndicator>
      </span>
    </MenuPrimitive.RadioItem>
  );
}
