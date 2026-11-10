'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CapturePasteInput,
  capturePasteInputSchema,
  VACANCY_PARSE_LIMITS,
} from '@jobflow/shared';
import { type KeyboardEvent, useEffect } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { uk } from '@/shared/i18n';
import { textOrNull } from '@/shared/lib/text-or-null';
import { useFieldError } from '@/shared/lib/use-field-error';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Kbd } from '@/shared/ui/kbd';
import { STATE_TEXT } from '@/shared/ui/state-text';
import { Textarea } from '@/shared/ui/textarea';

import { type AddPrefill, addPrefillOf, type AddQuery } from '../lib/add-prefill';
import { type CapturedDraft, usePasteApplication } from '../model/use-add-application';
import { AddFlow, type AddStep } from './add-flow';
import { AddForm } from './add-form';

export type PasteFormProps = Readonly<{
  query: AddQuery;
  actions?: { onCaptured: (capture: CapturedDraft) => void };
}>;

type PasteValues = Pick<AddPrefill, 'text' | 'url'>;

type PasteMethods = UseFormReturn<PasteValues, unknown, CapturePasteInput>;

type PasteFieldProps = Readonly<{ methods: PasteMethods; autoFocus: boolean }>;

type PasteFieldsProps = Readonly<{
  step: AddStep;
  query: AddQuery;
  initial: PasteValues;
  actions: PasteFormProps['actions'];
}>;

const COPY = uk.add.paste;

const BLANK: PasteValues = { text: '', url: '' };

const FIELDS = ['text', 'url'] as const;

const ERRORS = {
  text: COPY.errors.text(
    new Intl.NumberFormat(uk.locale).format(VACANCY_PARSE_LIMITS.textMaxLength),
  ),
  url: COPY.errors.url,
} as const;

const resolver = zodResolver(
  z
    .custom<PasteValues>()
    .transform(({ text, url }): unknown => ({ text, url: textOrNull(url) }))
    .pipe(capturePasteInputSchema),
);

function submitOnModEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  const modified = event.metaKey || event.ctrlKey;
  if (event.key !== 'Enter' || !modified || event.nativeEvent.isComposing) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

function TextField({ methods, autoFocus }: PasteFieldProps) {
  const error = useFieldError({ control: methods.control, name: 'text', messages: ERRORS });
  return (
    <Field label={COPY.fields.text} footer={{ error }}>
      <Textarea
        required
        rows={7}
        autoFocus={autoFocus}
        placeholder={COPY.placeholders.text}
        className="max-h-96 min-h-44"
        onKeyDown={submitOnModEnter}
        {...methods.register('text')}
      />
    </Field>
  );
}

function UrlField({ methods }: Pick<PasteFieldProps, 'methods'>) {
  const error = useFieldError({ control: methods.control, name: 'url', messages: ERRORS });
  return (
    <Field label={COPY.fields.url} footer={{ hint: COPY.urlHint, error }}>
      <Input
        type="url"
        inputMode="url"
        placeholder={COPY.placeholders.url}
        {...methods.register('url')}
      />
    </Field>
  );
}

function ShortcutHint() {
  return (
    <p className={STATE_TEXT.meta}>
      <Kbd>{COPY.shortcut.mac}</Kbd> {COPY.shortcut.or} <Kbd>{COPY.shortcut.other}</Kbd>
    </p>
  );
}

function PasteFields({ step, query, initial, actions }: PasteFieldsProps) {
  const methods = useForm<PasteValues, unknown, CapturePasteInput>({
    mode: 'onTouched',
    defaultValues: initial,
    resolver,
  });
  const { setFocus } = methods;
  useEffect(() => {
    if (addPrefillOf(query).focusPaste) setFocus('text');
  }, [query, setFocus]);
  const mutation = usePasteApplication({
    form: { fields: FIELDS, setError: methods.setError, messages: ERRORS },
    onAdded: (added) => {
      step.onAdded(added);
      actions?.onCaptured({ applicationId: added.applicationId, jobId: added.jobId });
    },
  });
  return (
    <AddForm
      form={{ label: COPY.title, methods }}
      submit={{ label: COPY.submit, variant: 'primary', mutation, hint: <ShortcutHint /> }}
    >
      <TextField methods={methods} autoFocus={step.autoFocus} />
      <UrlField methods={methods} />
    </AddForm>
  );
}

export function PasteForm({ query, actions }: PasteFormProps) {
  const prefill = addPrefillOf(query);
  return (
    <AddFlow focusOnMount={prefill.focusPaste}>
      {(step) => (
        <PasteFields
          step={step}
          query={query}
          initial={step.first ? prefill : BLANK}
          actions={actions}
        />
      )}
    </AddFlow>
  );
}
