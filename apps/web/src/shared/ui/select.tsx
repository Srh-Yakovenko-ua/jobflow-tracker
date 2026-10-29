'use client';

import { Select as SelectPrimitive } from 'radix-ui';
import { useRef } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { ClearButton } from './clear-button';
import { fieldLabelId, useField } from './field';
import {
  FIELD_SURFACE,
  MENU_LABEL,
  MENU_SURFACE,
  OPTION_ROW,
  type SelectOption,
  type SelectOptionGroup,
} from './field-surface';
import { CheckSlot, OptionContent } from './option-content';
import { SelectIndicators } from './select-indicators';
import { Spinner } from './spinner';

export type SelectView = {
  placeholder?: string;
  clearable?: boolean;
  status?: 'loading' | 'disabled';
};

export type SelectProps = Readonly<{
  groups: readonly SelectOptionGroup[];
  value: string;
  onValueChange: (value: string) => void;
  view?: SelectView;
}>;

const TRIGGER = cn(
  FIELD_SURFACE.self,
  FIELD_SURFACE.height.trigger,
  'group touch-target flex w-full items-center gap-2 pr-1.5 pl-2.75 text-left data-placeholder:text-ink-3 data-[state=open]:bg-surface data-[state=open]:focus-halo',
);

const ITEM =
  'data-highlighted:bg-accent-tint data-highlighted:shadow-[inset_2px_0_0_var(--accent)] data-[state=checked]:font-semibold';

const NAME_FROM_CONTENT = { 'aria-labelledby': undefined } as const;

type SelectItemProps = Readonly<{ option: SelectOption; checked: boolean }>;

function SelectItem({ option, checked }: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      value={option.value}
      data-focus="option"
      {...NAME_FROM_CONTENT}
      className={cn(OPTION_ROW, ITEM)}
    >
      <OptionContent
        option={option}
        label={<SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>}
      />
      <CheckSlot checked={checked} />
    </SelectPrimitive.Item>
  );
}

type SelectMenuProps = Pick<SelectProps, 'groups' | 'value'> &
  Readonly<{ labelledBy: string | undefined }>;

function SelectMenu({ groups, value, labelledBy }: SelectMenuProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        role="dialog"
        aria-modal
        aria-labelledby={labelledBy}
        position="popper"
        sideOffset={6}
        className={cn(
          MENU_SURFACE,
          'max-h-(--radix-select-content-available-height) w-(--radix-select-trigger-width)',
        )}
      >
        <SelectPrimitive.Viewport
          role="listbox"
          aria-labelledby={labelledBy}
          className="flex flex-col gap-px"
        >
          {groups.map((group) => (
            <SelectPrimitive.Group key={group.label ?? group.options[0]?.value}>
              {group.label && (
                <SelectPrimitive.Label className={MENU_LABEL}>{group.label}</SelectPrimitive.Label>
              )}
              {group.options.map((option) => (
                <SelectItem key={option.value} option={option} checked={option.value === value} />
              ))}
            </SelectPrimitive.Group>
          ))}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function Select({ groups, value, onValueChange, view = {} }: SelectProps) {
  const field = useField();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const loading = view.status === 'loading';
  const clearable = Boolean(view.clearable) && value !== '';
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      disabled={view.status === 'disabled'}
      {...(loading && { open: false })}
    >
      <div className="relative">
        <SelectPrimitive.Trigger
          ref={triggerRef}
          data-focus="halo"
          data-invalid={field['aria-invalid']}
          aria-haspopup="dialog"
          aria-busy={loading || undefined}
          {...field}
          className={TRIGGER}
        >
          {loading && <Spinner className="size-3.75 text-accent" />}
          <span className={cn('min-w-0 flex-1 truncate', clearable && 'pr-7')}>
            <SelectPrimitive.Value placeholder={view.placeholder} />
          </span>
          {!loading && <SelectIndicators />}
        </SelectPrimitive.Trigger>
        {clearable && (
          <span className="absolute inset-y-0 right-9.5 flex items-center">
            <ClearButton
              label={uk.ui.clear}
              onClear={() => {
                onValueChange('');
                triggerRef.current?.focus();
              }}
            />
          </span>
        )}
      </div>
      <SelectMenu groups={groups} value={value} labelledBy={field.id && fieldLabelId(field.id)} />
    </SelectPrimitive.Root>
  );
}
