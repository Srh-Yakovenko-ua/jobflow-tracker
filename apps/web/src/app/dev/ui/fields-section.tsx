'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { ClearButton } from '@/shared/ui/clear-button';
import { Combobox } from '@/shared/ui/combobox';
import { Field } from '@/shared/ui/field';
import type { SelectOption } from '@/shared/ui/field-surface';
import { Input } from '@/shared/ui/input';
import { Kbd } from '@/shared/ui/kbd';
import { NumberInput } from '@/shared/ui/number-input';
import { Textarea } from '@/shared/ui/textarea';

import { GallerySection, PANEL, TILE_GRID } from './gallery';
import { STACK_OPTIONS } from './specimen';

const COPY = uk.devUi.fields;

const SALARY_MEDIAN = 4900;

const NOTE_LIMIT = 280;

function SearchField() {
  const [query, setQuery] = useState('');
  const end = query ? (
    <ClearButton
      label={uk.ui.clear}
      onClear={() => {
        setQuery('');
      }}
    />
  ) : (
    <Kbd>{COPY.search.shortcut}</Kbd>
  );
  return (
    <Field label={COPY.search.label} hint={COPY.search.hint}>
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        placeholder={COPY.search.placeholder}
        adornments={{
          start: <Search aria-hidden size={15} className="flex-none text-ink-3" />,
          end,
        }}
      />
    </Field>
  );
}

function SalaryField() {
  const [salary, setSalary] = useState('4200');
  return (
    <Field
      label={COPY.salary.label}
      error={Number(salary) < SALARY_MEDIAN ? COPY.salary.error : undefined}
    >
      <Input
        inputMode="numeric"
        value={salary}
        onChange={(event) => {
          setSalary(event.target.value.replace(/\D/g, ''));
        }}
        className="tabular-nums"
        adornments={{
          start: (
            <span className="-ml-3 flex items-center self-stretch rounded-l-md bg-surface-3 px-2.5 text-[12.5px] text-ink-3">
              {COPY.salary.currency}
            </span>
          ),
          end: <span className="text-[12px] text-ink-3">{COPY.salary.net}</span>,
        }}
      />
    </Field>
  );
}

function TagsField() {
  const [options, setOptions] = useState<readonly SelectOption[]>(STACK_OPTIONS);
  const [tags, setTags] = useState(['react', 'typescript']);
  return (
    <Field label={COPY.tags.label} hint={COPY.tags.hint}>
      <Combobox
        groups={[{ options }]}
        selection={{ mode: 'multi', value: tags, onValueChange: setTags }}
        view={{
          label: COPY.tags.label,
          search: COPY.tags.search,
          placeholder: COPY.tags.placeholder,
        }}
        onCreate={(query) => {
          setOptions([...options, { value: query, label: query }]);
          setTags([...tags, query]);
        }}
      />
    </Field>
  );
}

function NoteField() {
  const [note, setNote] = useState('');
  return (
    <Field
      label={COPY.note.label}
      hint={COPY.note.hint}
      counter={{ value: note.length, max: NOTE_LIMIT }}
    >
      <Textarea
        value={note}
        maxLength={NOTE_LIMIT}
        onChange={(event) => {
          setNote(event.target.value);
        }}
        placeholder={COPY.note.placeholder}
      />
    </Field>
  );
}

export function FieldsSection() {
  const [days, setDays] = useState(7);
  return (
    <GallerySection header={COPY}>
      <div className={cn(PANEL, TILE_GRID)}>
        <Field label={COPY.company.label} hint={COPY.company.hint}>
          <Input placeholder={COPY.company.placeholder} />
        </Field>
        <SearchField />
        <SalaryField />
        <Field label={COPY.threshold.label} hint={COPY.threshold.hint}>
          <NumberInput
            value={days}
            onValueChange={setDays}
            range={{ min: 1, max: 30 }}
            unit={COPY.threshold.unit}
          />
        </Field>
        <TagsField />
        <NoteField />
        <Field label={COPY.score.label} hint={COPY.score.hint}>
          <Input disabled placeholder={COPY.score.placeholder} />
        </Field>
      </div>
    </GallerySection>
  );
}
