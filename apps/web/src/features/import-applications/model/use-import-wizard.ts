'use client';

import {
  autoMappingOf,
  type ImportApplicationsResponse,
  type ImportField,
  type ImportMapping,
  REQUIRED_IMPORT_FIELDS,
} from '@jobflow/shared';
import { useState } from 'react';

import { useUserTimeZone } from '@/entities/user';

import { type ImportFileRefusal, type ImportSheet, readImportFile } from '../lib/import-file';
import { candidatesOf, type ImportDraft } from '../lib/import-rows';
import { useImportApplicationsMutation } from './use-import-applications-mutation';

export type ImportStep =
  | Readonly<{ name: 'upload'; refusal: ImportFileRefusal | null; reading: boolean }>
  | Readonly<{ name: 'mapping'; draft: ImportDraft; missingShown: boolean }>
  | Readonly<{ name: 'preview'; draft: ImportDraft; now: Date }>
  | Readonly<{ name: 'result'; response: ImportApplicationsResponse }>;

export type ImportStepName = ImportStep['name'];

const FIRST_STEP: Extract<ImportStep, { name: 'upload' }> = {
  name: 'upload',
  refusal: null,
  reading: false,
};

export function missingFieldsOf(mapping: ImportMapping): readonly ImportField[] {
  return REQUIRED_IMPORT_FIELDS.filter((field) => mapping[field] === undefined);
}

function mappingStepOf(sheet: ImportSheet, timeZone: string): ImportStep {
  const draft = { sheet, mapping: autoMappingOf(sheet.header), timeZone };
  return { name: 'mapping', draft, missingShown: false };
}

export function useImportWizard() {
  const timeZone = useUserTimeZone();
  const [step, setStep] = useState<ImportStep>(FIRST_STEP);
  const importing = useImportApplicationsMutation();
  const pick = async (file: File) => {
    setStep({ ...FIRST_STEP, reading: true });
    const read = await readImportFile(file);
    setStep(
      read.kind === 'sheet'
        ? mappingStepOf(read.sheet, timeZone)
        : { ...FIRST_STEP, refusal: read.reason },
    );
  };
  const map = (draft: ImportDraft) => {
    setStep({ name: 'mapping', draft, missingShown: false });
  };
  const preview = (draft: ImportDraft) => {
    const complete = missingFieldsOf(draft.mapping).length === 0;
    setStep(
      complete
        ? { name: 'preview', draft, now: new Date() }
        : { name: 'mapping', draft, missingShown: true },
    );
  };
  const submit = (draft: ImportDraft) => {
    importing.submit({ rows: candidatesOf(draft) }, (response) => {
      setStep({ name: 'result', response });
    });
  };
  const restart = () => {
    setStep(FIRST_STEP);
  };
  return {
    step,
    importing: importing.isPending,
    actions: { pick, map, preview, submit, restart },
  };
}

export type ImportWizardModel = ReturnType<typeof useImportWizard>;
