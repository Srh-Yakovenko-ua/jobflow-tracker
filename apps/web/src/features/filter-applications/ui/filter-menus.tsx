'use client';

import {
  type LocalizedLabel,
  type Source,
  SOURCE_LABELS,
  SOURCES,
  STAGE_LABELS,
  STAGES,
} from '@jobflow/shared';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Checkbox } from '@/shared/ui/checkbox';
import { Field } from '@/shared/ui/field';
import { MENU_LABEL } from '@/shared/ui/field-surface';
import { Input } from '@/shared/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import type { ChoiceOption } from '@/shared/ui/radio-group';

import { chipsOf } from '../model/application-filters';
import { useApplicationFilters } from '../model/filters-store';

const COPY = uk.board.filters;

const SALARY_DIGITS = 9;

const PILL = {
  base: 'touch-target flex h-8.5 flex-none items-center gap-2 rounded-md px-3 text-[12.5px] transition-colors duration-(--duration-instant) ease-standard',
  idle: 'bg-surface text-ink-2 inset-ring inset-ring-line hover:bg-surface-2 active:bg-surface-3',
  picked: 'bg-accent-tint font-semibold text-accent-ink hover:bg-accent/15 active:bg-accent/20',
} as const;

const CHOICE_GRID = 'grid grid-cols-2 gap-x-4';

const LEGEND = cn(MENU_LABEL, 'px-0');

function choicesOf<Value extends string>(
  values: readonly Value[],
  labels: Record<Value, LocalizedLabel>,
): ChoiceOption<Value>[] {
  return values.map((value) => ({ value, label: labels[value].labelUk }));
}

const SOURCE_CHOICES = choicesOf(SOURCES, SOURCE_LABELS);

const STAGE_CHOICES = choicesOf(STAGES, STAGE_LABELS);

type ChoiceChecksProps<Value extends string> = Readonly<{
  legend: string;
  options: readonly ChoiceOption<Value>[];
  picked: readonly Value[] | undefined;
  onToggle: (value: Value) => void;
}>;

type FilterPillProps = Readonly<{
  pill: { label: string; picked: boolean };
  menu: string;
  children: ReactNode;
}>;

function FilterPill({ pill, menu, children }: FilterPillProps) {
  return (
    <Popover>
      <PopoverTrigger className={cn(PILL.base, pill.picked ? PILL.picked : PILL.idle)}>
        {pill.label}
        <ChevronDown aria-hidden size={15} className={pill.picked ? 'opacity-75' : 'text-ink-3'} />
      </PopoverTrigger>
      <PopoverContent aria-label={menu} className="flex w-76 max-w-[calc(100vw-16px)] flex-col">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function sourcePillOf(sources: readonly Source[] | undefined): string {
  const [only] = sources ?? [];
  if (sources === undefined || only === undefined) {
    return COPY.source.pill(COPY.source.all);
  }
  return COPY.source.pill(
    sources.length === 1 ? SOURCE_LABELS[only].labelUk : String(sources.length),
  );
}

function ChoiceChecks<Value extends string>({
  legend,
  options,
  picked,
  onToggle,
}: ChoiceChecksProps<Value>) {
  return (
    <fieldset className={CHOICE_GRID}>
      <legend className={LEGEND}>{legend}</legend>
      {options.map((option) => (
        <Checkbox
          key={option.value}
          label={option.label}
          checked={picked?.includes(option.value) ?? false}
          onCheckedChange={() => {
            onToggle(option.value);
          }}
        />
      ))}
    </fieldset>
  );
}

function SourceMenu() {
  const sources = useApplicationFilters((store) => store.filters.source);
  const { toggleSource } = useApplicationFilters((store) => store.actions);
  const pill = { label: sourcePillOf(sources), picked: sources !== undefined };
  return (
    <FilterPill pill={pill} menu={COPY.source.menu}>
      <ChoiceChecks
        legend={COPY.source.menu}
        options={SOURCE_CHOICES}
        picked={sources}
        onToggle={toggleSource}
      />
    </FilterPill>
  );
}

function MoreFiltersMenu() {
  const filters = useApplicationFilters((store) => store.filters);
  const actions = useApplicationFilters((store) => store.actions);
  const count = chipsOf({ ...filters, source: undefined }).length;
  const salary = filters.salaryFrom === undefined ? '' : String(filters.salaryFrom);
  return (
    <FilterPill pill={{ label: COPY.more.pill(count), picked: count > 0 }} menu={COPY.more.menu}>
      <ChoiceChecks
        legend={COPY.stage}
        options={STAGE_CHOICES}
        picked={filters.stage}
        onToggle={actions.toggleStage}
      />
      <Checkbox
        label={COPY.hasScore}
        checked={filters.hasScore === true}
        onCheckedChange={actions.toggleHasScore}
      />
      <Checkbox
        label={COPY.silentOnly}
        checked={filters.silence?.includes('silent') ?? false}
        onCheckedChange={actions.toggleSilentOnly}
      />
      <div className="pt-2">
        <Field label={COPY.salaryFrom}>
          <Input
            inputMode="numeric"
            autoComplete="off"
            maxLength={SALARY_DIGITS}
            value={salary}
            onChange={(event) => {
              actions.setSalaryFrom(event.target.value.replace(/\D/g, ''));
            }}
          />
        </Field>
      </div>
    </FilterPill>
  );
}

export function FilterMenus() {
  return (
    <>
      <SourceMenu />
      <MoreFiltersMenu />
    </>
  );
}
