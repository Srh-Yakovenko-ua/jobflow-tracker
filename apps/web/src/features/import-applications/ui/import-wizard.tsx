'use client';

import { AnimatePresence } from 'motion/react';

import { uk } from '@/shared/i18n';
import { Fade } from '@/shared/ui/fade';
import { PAGE_TITLE } from '@/shared/ui/page-title';

import {
  type ImportStepName,
  type ImportWizardModel,
  useImportWizard,
} from '../model/use-import-wizard';
import { MappingStep } from './mapping-step';
import { PreviewStep } from './preview-step';
import { ResultStep } from './result-step';
import { UploadStep } from './upload-step';

const COPY = uk.dataImport;

const STEP_NUMBERS: Record<ImportStepName, number | null> = {
  upload: 1,
  mapping: 2,
  preview: 3,
  result: null,
};

const STEP_TOTAL = 3;

function StepBody({ step, importing, actions }: ImportWizardModel) {
  switch (step.name) {
    case 'upload':
      return <UploadStep step={step} onFile={(file) => void actions.pick(file)} />;
    case 'mapping':
      return <MappingStep step={step} actions={actions} />;
    case 'preview':
      return <PreviewStep step={step} model={{ importing, actions }} />;
    case 'result':
      return <ResultStep response={step.response} onRestart={actions.restart} />;
    default: {
      const unhandled: never = step;
      throw new Error(`Unknown import step ${JSON.stringify(unhandled)}`);
    }
  }
}

export function ImportWizard() {
  const wizard = useImportWizard();
  const number = STEP_NUMBERS[wizard.step.name];
  return (
    <div className="flex max-w-[960px] min-w-0 flex-col gap-8">
      <div className="flex min-w-0 flex-col gap-2">
        {number !== null && (
          <span className="eyebrow text-ink-3 tabular-nums">{COPY.step(number, STEP_TOTAL)}</span>
        )}
        <h1 className={PAGE_TITLE}>{COPY.title}</h1>
        <p className="max-w-[60ch] text-[14px] leading-[1.55] text-ink-2">{COPY.lead}</p>
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        <Fade key={wizard.step.name} className="min-w-0">
          <StepBody {...wizard} />
        </Fade>
      </AnimatePresence>
    </div>
  );
}
