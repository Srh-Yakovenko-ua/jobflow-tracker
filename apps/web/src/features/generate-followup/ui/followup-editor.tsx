'use client';

import { type ApplicationResponse, FOLLOWUP_LIMITS, type FollowupOutput } from '@jobflow/shared';
import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { DONE_DOT } from '@/shared/ui/async-state';
import { Button } from '@/shared/ui/button';
import { copyToClipboard } from '@/shared/ui/copy-button';
import { Field } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { STATE_TEXT } from '@/shared/ui/state-text';
import { Textarea } from '@/shared/ui/textarea';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { type DraftEdit, readDraftEdit, rememberDraftEdit } from '../lib/draft-edits';
import type { FollowupReady } from '../lib/followup-view';
import { FollowupChoices, type FollowupMethods } from './followup-choices';

export type FollowupEditorDraft = Readonly<{
  ready: FollowupReady;
  applicationId: ApplicationResponse['id'];
}>;

export type FollowupEditorProps = Readonly<{
  draft: FollowupEditorDraft;
  methods: FollowupMethods;
  actions: Readonly<{ onVariant: () => void; onSent: () => void }>;
  status: Readonly<{ generating: boolean; marking: boolean; sent: boolean }>;
}>;

const COPY = uk.followup;

const ACTION = cn('h-9', TOUCH_HEIGHT);

function letterOf(subject: string, body: string): string {
  return [subject, body].filter((part) => part.trim() !== '').join('\n\n');
}

function initialEdit({ ready, applicationId }: FollowupEditorDraft): DraftEdit {
  const stored = readDraftEdit(applicationId);
  if (stored?.key === ready.key) return stored;
  return { key: ready.key, subject: ready.draft.subject, body: ready.draft.body };
}

function useEditedDraft(draft: FollowupEditorDraft) {
  const [edit, setEdit] = useState(() => initialEdit(draft));
  const change = (part: Partial<FollowupOutput>) => {
    const next = { ...edit, ...part };
    setEdit(next);
    rememberDraftEdit(draft.applicationId, next);
  };
  return { edit, change };
}

export function FollowupEditor({ draft, methods, actions, status }: FollowupEditorProps) {
  const { ready } = draft;
  const { edit, change } = useEditedDraft(draft);
  const { subject, body } = edit;
  const empty = body.trim() === '';
  return (
    <div className="flex flex-col gap-3">
      <p className={cn('flex items-center gap-2.25 font-ui text-offer', STATE_TEXT.eyebrow)}>
        {!ready.own && DONE_DOT}
        {ready.own ? COPY.own : COPY.ready}
      </p>
      <Field label={COPY.subject}>
        <Input
          maxLength={FOLLOWUP_LIMITS.subjectMaxLength}
          value={subject}
          onChange={(event) => {
            change({ subject: event.target.value });
          }}
        />
      </Field>
      <Field label={COPY.body}>
        <Textarea
          rows={9}
          maxLength={FOLLOWUP_LIMITS.bodyMaxLength}
          value={body}
          onChange={(event) => {
            change({ body: event.target.value });
          }}
        />
      </Field>
      <FollowupChoices methods={methods} />
      <div className="flex flex-wrap gap-2">
        <Button
          className={ACTION}
          disabled={empty}
          onClick={() => {
            copyToClipboard(letterOf(subject, body));
          }}
        >
          {COPY.copy}
        </Button>
        <Button
          variant="outline"
          className={ACTION}
          loading={status.generating}
          onClick={actions.onVariant}
        >
          {COPY.variant}
        </Button>
        <Button
          variant="ghost"
          className={ACTION}
          loading={status.marking}
          disabled={status.sent || empty}
          onClick={actions.onSent}
        >
          {COPY.markSent}
        </Button>
      </div>
    </div>
  );
}
