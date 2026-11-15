'use client';

import {
  IMPORT_FIELD_LABELS,
  IMPORT_FIELDS,
  type ImportField,
  type ImportMapping,
  REQUIRED_IMPORT_FIELDS,
} from '@jobflow/shared';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Field } from '@/shared/ui/field';
import type { SelectOptionGroup } from '@/shared/ui/field-surface';
import { Select } from '@/shared/ui/select';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import type { ImportDraft } from '../lib/import-rows';
import {
  type ImportStep,
  type ImportWizardModel,
  missingFieldsOf,
} from '../model/use-import-wizard';
import { StepHeading } from './step-heading';

const COPY = uk.dataImport.mapping;

const REQUIRED: ReadonlySet<ImportField> = new Set(REQUIRED_IMPORT_FIELDS);

const SELECT_VIEW = { placeholder: COPY.placeholder, clearable: true } as const;

export type MappingStepProps = Readonly<{
  step: Extract<ImportStep, { name: 'mapping' }>;
  actions: Pick<ImportWizardModel['actions'], 'map' | 'preview' | 'restart'>;
}>;

function columnGroupsOf(header: readonly string[]): readonly SelectOptionGroup[] {
  const options = header.map((text, index) => ({
    value: String(index),
    label: text.trim() === '' ? COPY.column(index + 1) : text.trim(),
  }));
  return [{ options }];
}

type MappingChange = Readonly<{ field: ImportField; value: string }>;

function mappingWith(mapping: ImportMapping, { field, value }: MappingChange): ImportMapping {
  const kept = Object.entries(mapping).filter(([key]) => key !== field);
  return Object.fromEntries(value === '' ? kept : [...kept, [field, Number(value)]]);
}

type FieldSelectProps = Readonly<{
  field: ImportField;
  draft: ImportDraft;
  state: Readonly<{ groups: readonly SelectOptionGroup[]; missing: boolean }>;
  onMap: (draft: ImportDraft) => void;
}>;

function FieldSelect({ field, draft, state, onMap }: FieldSelectProps) {
  const index = draft.mapping[field];
  return (
    <Field
      label={IMPORT_FIELD_LABELS[field].labelUk}
      footer={{
        hint: REQUIRED.has(field) ? COPY.required : COPY.optional,
        error: state.missing ? COPY.missing : undefined,
      }}
    >
      <Select
        groups={state.groups}
        value={index === undefined ? '' : String(index)}
        onValueChange={(value) => {
          onMap({ ...draft, mapping: mappingWith(draft.mapping, { field, value }) });
        }}
        view={SELECT_VIEW}
      />
    </Field>
  );
}

export function MappingStep({ step, actions }: MappingStepProps) {
  const { draft } = step;
  const groups = columnGroupsOf(draft.sheet.header);
  const missing = step.missingShown ? missingFieldsOf(draft.mapping) : [];
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <StepHeading
        title={COPY.title}
        detail={COPY.file(draft.sheet.fileName, draft.sheet.rows.length)}
      />
      <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {IMPORT_FIELDS.map((field) => (
          <FieldSelect
            key={field}
            field={field}
            draft={draft}
            state={{ groups, missing: missing.includes(field) }}
            onMap={actions.map}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" className={TOUCH_HEIGHT} onClick={actions.restart}>
          {COPY.back}
        </Button>
        <Button
          className={TOUCH_HEIGHT}
          onClick={() => {
            actions.preview(draft);
          }}
        >
          {COPY.next}
        </Button>
      </div>
    </div>
  );
}
