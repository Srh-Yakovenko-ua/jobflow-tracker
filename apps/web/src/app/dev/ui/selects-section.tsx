'use client';

import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Combobox } from '@/shared/ui/combobox';
import { Field } from '@/shared/ui/field';
import type { SelectOption } from '@/shared/ui/field-surface';
import { Select, type SelectView } from '@/shared/ui/select';

import { GallerySection, Note, PANEL, Specimen, TILE_GRID } from './gallery';
import { CV_GROUPS, SOURCE_OPTIONS, STACK_OPTIONS, STAGE_GROUPS } from './specimen';

const COPY = uk.devUi.selects;

const STATES = COPY.states;

function SourcePicker() {
  const [options, setOptions] = useState<readonly SelectOption[]>(SOURCE_OPTIONS);
  const [source, setSource] = useState('djinni');
  return (
    <Specimen eyebrow={COPY.source.eyebrow}>
      <Field label={COPY.source.label}>
        <Combobox
          groups={[{ options }]}
          selection={{ mode: 'single', value: source, onValueChange: setSource }}
          view={COPY.source}
          onCreate={(query) => {
            setOptions([...options, { value: query, label: query }]);
            setSource(query);
          }}
        />
      </Field>
      <Note>{COPY.source.note}</Note>
    </Specimen>
  );
}

function StackPicker() {
  const [stack, setStack] = useState(['react', 'typescript']);
  return (
    <Specimen eyebrow={COPY.stack.eyebrow}>
      <Field label={COPY.stack.label}>
        <Combobox
          groups={[{ label: COPY.stack.group, options: STACK_OPTIONS }]}
          selection={{ mode: 'multi', value: stack, onValueChange: setStack }}
          view={COPY.stack}
        />
      </Field>
      <Note>{COPY.stack.note}</Note>
    </Specimen>
  );
}

function CvPicker() {
  const [cv, setCv] = useState('cv-v2');
  return (
    <Specimen eyebrow={COPY.cv.eyebrow}>
      <Field label={COPY.cv.label}>
        <Select
          groups={CV_GROUPS}
          value={cv}
          onValueChange={setCv}
          view={{ placeholder: COPY.cv.placeholder, clearable: true }}
        />
      </Field>
      <Note>{COPY.cv.note}</Note>
    </Specimen>
  );
}

type StateSpecimen = { caption: string; view: SelectView; value?: string; error?: string };

const STATE_SPECIMENS: readonly StateSpecimen[] = [
  { caption: STATES.captions.empty, view: { placeholder: STATES.placeholder } },
  { caption: STATES.captions.filled, view: {}, value: 'tech_interview' },
  {
    caption: STATES.captions.error,
    view: { placeholder: STATES.errorPlaceholder },
    error: STATES.error,
  },
  { caption: STATES.captions.loading, view: { placeholder: STATES.loading, status: 'loading' } },
  { caption: STATES.captions.disabled, view: { placeholder: STATES.disabled, status: 'disabled' } },
];

function StateSelect({ specimen }: Readonly<{ specimen: StateSpecimen }>) {
  const [value, setValue] = useState(specimen.value ?? '');
  return (
    <Field label={specimen.caption} error={specimen.error}>
      <Select groups={STAGE_GROUPS} value={value} onValueChange={setValue} view={specimen.view} />
    </Field>
  );
}

function SelectStates() {
  return (
    <Specimen eyebrow={STATES.eyebrow} className="gap-3">
      {STATE_SPECIMENS.map((specimen) => (
        <StateSelect key={specimen.caption} specimen={specimen} />
      ))}
      <Note>{STATES.note}</Note>
    </Specimen>
  );
}

export function SelectsSection() {
  return (
    <GallerySection header={COPY}>
      <div className={cn(TILE_GRID, 'items-start')}>
        <div className={PANEL}>
          <SourcePicker />
        </div>
        <div className={PANEL}>
          <StackPicker />
        </div>
        <div className={PANEL}>
          <CvPicker />
        </div>
        <div className={PANEL}>
          <SelectStates />
        </div>
      </div>
    </GallerySection>
  );
}
