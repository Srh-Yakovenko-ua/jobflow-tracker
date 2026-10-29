'use client';

import { Search } from 'lucide-react';
import { useRef, useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { ClearButton } from '@/shared/ui/clear-button';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Kbd } from '@/shared/ui/kbd';
import { NumberInput } from '@/shared/ui/number-input';
import { Select } from '@/shared/ui/select';
import { SOURCE_OPTIONS } from '@/shared/ui/specimen-options';
import { TagInput } from '@/shared/ui/tag-input';
import { Textarea } from '@/shared/ui/textarea';

import { GallerySection, PANEL, TILE_GRID } from './gallery';

const COPY = uk.devUi.fields;

const SALARY_MEDIAN = 4900;

const NOTE_LIMIT = 2000;

const WIDE_TILE = 'min-w-0 sm:col-span-2';

function SearchField() {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const end = query ? (
    <ClearButton
      label={uk.ui.clear}
      onClear={() => {
        setQuery('');
        inputRef.current?.focus();
      }}
    />
  ) : (
    <Kbd>{COPY.search.shortcut}</Kbd>
  );
  return (
    <Field label={COPY.search.label} footer={{ hint: COPY.search.hint }}>
      <Input
        ref={inputRef}
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
      footer={{ error: Number(salary) < SALARY_MEDIAN ? COPY.salary.error : undefined }}
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

function SourceField() {
  const [source, setSource] = useState('djinni');
  return (
    <Field label={uk.devUi.selects.source.label} footer={{ hint: COPY.source.hint }}>
      <Select groups={[{ options: SOURCE_OPTIONS }]} value={source} onValueChange={setSource} />
    </Field>
  );
}

function TagsField() {
  const [tags, setTags] = useState(['React', 'TypeScript', 'Node']);
  return (
    <div className={WIDE_TILE}>
      <Field
        label={COPY.tags.label}
        footer={{ hint: tags.length > 0 ? COPY.tags.count(tags.length) : COPY.tags.hint }}
      >
        <TagInput value={tags} onValueChange={setTags} placeholder={COPY.tags.placeholder} />
      </Field>
    </div>
  );
}

function NoteField() {
  const [note, setNote] = useState('');
  return (
    <div className={WIDE_TILE}>
      <Field
        label={COPY.note.label}
        footer={{ hint: COPY.note.hint, counter: { value: note.length, max: NOTE_LIMIT } }}
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
    </div>
  );
}

export function FieldsSection() {
  const [days, setDays] = useState(7);
  return (
    <GallerySection header={COPY}>
      <div className={cn(PANEL, TILE_GRID)}>
        <Field label={COPY.company.label} footer={{ hint: COPY.company.hint }}>
          <Input placeholder={COPY.company.placeholder} />
        </Field>
        <SearchField />
        <SalaryField />
        <Field label={COPY.threshold.label} footer={{ hint: COPY.threshold.hint }}>
          <NumberInput
            value={days}
            onValueChange={setDays}
            range={{ min: 1, max: 30 }}
            unit={COPY.threshold.unit}
          />
        </Field>
        <SourceField />
        <TagsField />
        <NoteField />
        <Field label={COPY.score.label} footer={{ hint: COPY.score.hint }}>
          <Input disabled placeholder={COPY.score.placeholder} />
        </Field>
      </div>
    </GallerySection>
  );
}
