'use client';

import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Combobox } from '@/shared/ui/combobox';
import { Field } from '@/shared/ui/field';
import { Select, type SelectView } from '@/shared/ui/select';
import { SOURCE_OPTIONS, useStackSpecimen } from '@/shared/ui/specimen-options';

import { GallerySection, Note, PANEL, Specimen, TILE_GRID } from './gallery';
import { CV_GROUPS, STAGE_GROUPS } from './specimen';

const COPY = uk.devUi.selects;

const STATES = COPY.states;

function SourcePicker() {
  const [source, setSource] = useState('djinni');
  return (
    <Specimen eyebrow={COPY.source.eyebrow}>
      <Field label={COPY.source.label}>
        <Combobox
          groups={[{ options: SOURCE_OPTIONS }]}
          selection={{ mode: 'single', value: source, onValueChange: setSource }}
          view={COPY.source}
        />
      </Field>
      <Note>{COPY.source.note}</Note>
    </Specimen>
  );
}

function StackPicker() {
  const stack = useStackSpecimen(['react', 'typescript']);
  return (
    <Specimen eyebrow={COPY.stack.eyebrow}>
      <Field label={COPY.stack.label}>
        <Combobox {...stack} view={{ ...COPY.stack, footer: false }} />
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
    <Field label={specimen.caption} footer={{ error: specimen.error }}>
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
