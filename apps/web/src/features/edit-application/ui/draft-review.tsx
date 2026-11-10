'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type ApplicationResponse, DRAFT_PLACEHOLDERS } from '@jobflow/shared';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ScoreBadge } from '@/entities/application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button, buttonLinkClasses } from '@/shared/ui/button';
import { FormServerError } from '@/shared/ui/form-server-error';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { REVIEWED_FIELDS, type ReviewFields, reviewFieldsOf } from '../lib/review-fields';
import {
  type EditField,
  editFormSchemaOf,
  type EditFormValues,
  formValuesOf,
} from '../model/edit-form';
import { useConfirmDraft } from '../model/use-confirm-draft';
import { REVIEW_NAMES } from './confidence-chip';
import { ReviewFormFields } from './review-form-fields';

export type DraftReviewProps = Readonly<{
  application: ApplicationResponse;
  actions: { onConfirmed: () => void };
  heading?: ReactNode;
  view?: { name?: string; focusField?: EditField };
}>;

const COPY = uk.add.review;

function ReviewNote({ reviews }: Readonly<{ reviews: ReviewFields }>) {
  const doubted = REVIEWED_FIELDS.filter((field) => reviews[field].confidence === 'check');
  if (doubted.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-l-2 border-accent pl-3 text-[13.5px] leading-[1.55] text-ink-2">
      <p>{COPY.lead}</p>
      <ul className="flex flex-col gap-1">
        {doubted.map((field) => (
          <li key={field}>{COPY.note(REVIEW_NAMES[field], reviews[field].quote)}</li>
        ))}
      </ul>
    </div>
  );
}

function blankOr(value: string, placeholder: string): string {
  return value === placeholder ? '' : value;
}

function draftValuesOf(application: ApplicationResponse): EditFormValues {
  const values = formValuesOf(application);
  return {
    ...values,
    position: blankOr(values.position, DRAFT_PLACEHOLDERS.position),
    company: blankOr(values.company, DRAFT_PLACEHOLDERS.company),
  };
}

export function DraftReview({ application, actions, heading, view = {} }: DraftReviewProps) {
  const [source, setSource] = useState(application.source);
  const methods = useForm({
    mode: 'onTouched',
    defaultValues: draftValuesOf(application),
    resolver: zodResolver(editFormSchemaOf(application)),
  });
  const mutation = useConfirmDraft({
    applicationId: application.id,
    setError: methods.setError,
    actions,
  });
  const reviews = reviewFieldsOf(application);
  const send = methods.handleSubmit((patch) => {
    mutation.save(source === application.source ? patch : { ...patch, source });
  });
  return (
    <form
      method="post"
      noValidate
      aria-label={view.name ?? COPY.title}
      onSubmit={(event) => {
        void send(event);
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">{heading}</div>
        <ScoreBadge application={{ matchScore: application.matchScore, aiStatus: null }} />
      </div>
      <FormServerError control={methods.control} />
      <ReviewFormFields
        form={{ methods, ...(view.focusField !== undefined && { focusField: view.focusField }) }}
        application={application}
        reviews={reviews}
        source={{ value: source, onChange: setSource }}
      />
      {reviews !== null && <ReviewNote reviews={reviews} />}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" size="lg" loading={mutation.isPending} className={TOUCH_HEIGHT}>
          {COPY.confirm}
        </Button>
        <Link
          href={`/applications/${application.id}`}
          className={cn(buttonLinkClasses({ variant: 'outline', size: 'lg' }), TOUCH_HEIGHT)}
        >
          {COPY.open}
        </Link>
      </div>
    </form>
  );
}
